use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;

use crate::activity;
use crate::auth::{self, CurrentUser, PermissionGroup, PERMISSION_GROUPS};
use crate::error::ApiError;
use crate::state::AppState;

/// What the users page needs to show and hand out roles.
#[derive(Serialize, sqlx::FromRow)]
pub struct RoleSummary {
    pub id: i64,
    pub name: String,
    pub permissions: Vec<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RoleRow {
    id: i64,
    name: String,
    handle: String,
    permissions: Vec<String>,
    users: i64,
    created_at: DateTime<Utc>,
}

const ROLE_COLUMNS: &str = "r.id, r.name, r.handle, r.permissions, \
     (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS users, r.created_at";

#[derive(Serialize)]
pub struct RolesResponse {
    roles: Vec<RoleRow>,
    permission_groups: &'static [PermissionGroup],
}

#[derive(Serialize)]
pub struct RoleResponse {
    role: RoleRow,
    permission_groups: &'static [PermissionGroup],
}

#[derive(Deserialize)]
pub struct RoleBody {
    name: String,
    handle: String,
    #[serde(default)]
    permissions: Vec<String>,
}

pub async fn all_summaries(db: &PgPool) -> Result<Vec<RoleSummary>, ApiError> {
    let roles = sqlx::query_as("SELECT id, name, permissions FROM roles ORDER BY name")
        .fetch_all(db)
        .await?;
    Ok(roles)
}

pub async fn summaries(db: &PgPool, ids: &[i64]) -> Result<Vec<RoleSummary>, ApiError> {
    let roles = sqlx::query_as("SELECT id, name, permissions FROM roles WHERE id = ANY($1)")
        .bind(ids)
        .fetch_all(db)
        .await?;
    Ok(roles)
}

async fn find_role(db: &PgPool, id: i64) -> Result<RoleRow, ApiError> {
    let query = format!("SELECT {ROLE_COLUMNS} FROM roles r WHERE r.id = $1");
    let role: Option<RoleRow> = sqlx::query_as(&query).bind(id).fetch_optional(db).await?;
    role.ok_or(ApiError::NotFound)
}

struct CleanRole {
    name: String,
    handle: String,
    permissions: Vec<String>,
}

fn clean(body: RoleBody) -> Result<CleanRole, ApiError> {
    let name = body.name.trim().to_string();
    if name.is_empty() || name.chars().count() > 50 {
        return Err(ApiError::BadRequest("Give the role a title of at most 50 characters".into()));
    }
    let handle = body.handle.trim().to_lowercase();
    let handle_ok = !handle.is_empty()
        && handle.len() <= 50
        && handle.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_');
    if !handle_ok {
        return Err(ApiError::BadRequest(
            "The handle can only use lowercase letters, digits, '-' and '_' (at most 50)".into(),
        ));
    }
    let permissions = auth::normalize_permissions(&body.permissions)?;
    Ok(CleanRole { name, handle, permissions })
}

fn handle_taken(handle: &str) -> ApiError {
    ApiError::Conflict(format!("The handle '{handle}' is already used by another role"))
}

fn require_cover(actor: &CurrentUser, permissions: &[String]) -> Result<(), ApiError> {
    if !actor.covers(false, permissions) {
        return Err(ApiError::BadRequest(
            "A role can't have rights you don't have yourself".into(),
        ));
    }
    Ok(())
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<RolesResponse>, ApiError> {
    user.require("roles.view")?;
    let query = format!("SELECT {ROLE_COLUMNS} FROM roles r ORDER BY r.name");
    let roles: Vec<RoleRow> = sqlx::query_as(&query).fetch_all(&state.db).await?;
    Ok(Json(RolesResponse {
        roles,
        permission_groups: PERMISSION_GROUPS,
    }))
}

pub async fn get(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<RoleResponse>, ApiError> {
    user.require("roles.view")?;
    Ok(Json(RoleResponse {
        role: find_role(&state.db, id).await?,
        permission_groups: PERMISSION_GROUPS,
    }))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<RoleBody>,
) -> Result<(StatusCode, Json<RoleRow>), ApiError> {
    user.require("roles.create")?;
    let role = clean(body)?;
    require_cover(&user, &role.permissions)?;

    let created: Result<(i64,), sqlx::Error> =
        sqlx::query_as("INSERT INTO roles (name, handle, permissions) VALUES ($1, $2, $3) RETURNING id")
            .bind(&role.name)
            .bind(&role.handle)
            .bind(&role.permissions)
    .fetch_one(&state.db)
    .await;
    let id = match created {
        Ok((id,)) => id,
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => return Err(handle_taken(&role.handle)),
        Err(e) => return Err(e.into()),
    };

    let details = json!({ "handle": role.handle, "permissions": role.permissions });
    activity::record(&state.db, &user, "roles", "created role", None, &role.name, Some(details)).await;
    Ok((StatusCode::CREATED, Json(find_role(&state.db, id).await?)))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<RoleBody>,
) -> Result<Json<RoleRow>, ApiError> {
    user.require("roles.edit")?;
    let before = find_role(&state.db, id).await?;
    require_cover(&user, &before.permissions)?;
    let role = clean(body)?;
    require_cover(&user, &role.permissions)?;

    let result = sqlx::query("UPDATE roles SET name = $1, handle = $2, permissions = $3 WHERE id = $4")
        .bind(&role.name)
        .bind(&role.handle)
        .bind(&role.permissions)
        .bind(id)
        .execute(&state.db)
        .await;
    match result {
        Ok(_) => {}
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => return Err(handle_taken(&role.handle)),
        Err(e) => return Err(e.into()),
    }

    let mut details = json!({});
    if before.name != role.name {
        details["name"] = json!({ "from": before.name, "to": role.name });
    }
    if before.handle != role.handle {
        details["handle"] = json!({ "from": before.handle, "to": role.handle });
    }
    let added: Vec<&String> = role.permissions.iter().filter(|p| !before.permissions.contains(p)).collect();
    let removed: Vec<&String> = before.permissions.iter().filter(|p| !role.permissions.contains(p)).collect();
    if !added.is_empty() {
        details["permissions_added"] = json!(added);
    }
    if !removed.is_empty() {
        details["permissions_removed"] = json!(removed);
    }
    activity::record(&state.db, &user, "roles", "edited role", None, &role.name, Some(details)).await;
    Ok(Json(find_role(&state.db, id).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("roles.delete")?;
    let before = find_role(&state.db, id).await?;
    require_cover(&user, &before.permissions)?;

    sqlx::query("DELETE FROM roles WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    let details = json!({ "users": before.users, "permissions": before.permissions });
    activity::record(&state.db, &user, "roles", "deleted role", None, &before.name, Some(details)).await;
    Ok(StatusCode::NO_CONTENT)
}
