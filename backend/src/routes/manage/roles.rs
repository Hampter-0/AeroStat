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

use super::users::ensure_super_user_left;

/// What the users page needs to show and hand out roles.
#[derive(Serialize, sqlx::FromRow)]
pub struct RoleSummary {
    pub id: i64,
    pub name: String,
    pub super_user: bool,
    pub permissions: Vec<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RoleRow {
    id: i64,
    name: String,
    handle: String,
    super_user: bool,
    permissions: Vec<String>,
    users: i64,
    created_at: DateTime<Utc>,
}

const ROLE_COLUMNS: &str = "r.id, r.name, r.handle, r.super_user, r.permissions, \
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
    super_user: bool,
    #[serde(default)]
    permissions: Vec<String>,
}

pub async fn all_summaries(db: &PgPool) -> Result<Vec<RoleSummary>, ApiError> {
    let roles = sqlx::query_as("SELECT id, name, super_user, permissions FROM roles ORDER BY super_user DESC, name")
        .fetch_all(db)
        .await?;
    Ok(roles)
}

pub async fn summaries(db: &PgPool, ids: &[i64]) -> Result<Vec<RoleSummary>, ApiError> {
    let roles = sqlx::query_as("SELECT id, name, super_user, permissions FROM roles WHERE id = ANY($1)")
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
    super_user: bool,
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
    // A super user can do everything, so a list of permissions would only mislead.
    let permissions = if body.super_user {
        Vec::new()
    } else {
        auth::normalize_permissions(&body.permissions)?
    };
    Ok(CleanRole {
        name,
        handle,
        super_user: body.super_user,
        permissions,
    })
}

fn handle_taken(handle: &str) -> ApiError {
    ApiError::Conflict(format!("The handle '{handle}' is already used by another role"))
}

fn require_cover(actor: &CurrentUser, super_user: bool, permissions: &[String]) -> Result<(), ApiError> {
    if !actor.covers(super_user, permissions) {
        return Err(ApiError::BadRequest(
            "A role can't have rights you don't have yourself".into(),
        ));
    }
    Ok(())
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<RolesResponse>, ApiError> {
    user.require("roles.view")?;
    let query = format!("SELECT {ROLE_COLUMNS} FROM roles r ORDER BY r.super_user DESC, r.name");
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
    require_cover(&user, role.super_user, &role.permissions)?;

    let created: Result<(i64,), sqlx::Error> = sqlx::query_as(
        "INSERT INTO roles (name, handle, super_user, permissions) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(&role.name)
    .bind(&role.handle)
    .bind(role.super_user)
    .bind(&role.permissions)
    .fetch_one(&state.db)
    .await;
    let id = match created {
        Ok((id,)) => id,
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => return Err(handle_taken(&role.handle)),
        Err(e) => return Err(e.into()),
    };

    let details = json!({ "handle": role.handle, "super_user": role.super_user, "permissions": role.permissions });
    activity::record(&state.db, &user, "users", "created role", None, &role.name, Some(details)).await;
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
    require_cover(&user, before.super_user, &before.permissions)?;
    let role = clean(body)?;
    require_cover(&user, role.super_user, &role.permissions)?;

    let mut tx = state.db.begin().await?;
    let result = sqlx::query("UPDATE roles SET name = $1, handle = $2, super_user = $3, permissions = $4 WHERE id = $5")
        .bind(&role.name)
        .bind(&role.handle)
        .bind(role.super_user)
        .bind(&role.permissions)
        .bind(id)
        .execute(&mut *tx)
        .await;
    match result {
        Ok(_) => {}
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => return Err(handle_taken(&role.handle)),
        Err(e) => return Err(e.into()),
    }
    ensure_super_user_left(&mut tx, &user).await?;
    tx.commit().await?;

    let mut details = json!({});
    if before.name != role.name {
        details["name"] = json!({ "from": before.name, "to": role.name });
    }
    if before.handle != role.handle {
        details["handle"] = json!({ "from": before.handle, "to": role.handle });
    }
    if before.super_user != role.super_user {
        details["super_user"] = json!({ "from": before.super_user, "to": role.super_user });
    }
    let added: Vec<&String> = role.permissions.iter().filter(|p| !before.permissions.contains(p)).collect();
    let removed: Vec<&String> = before.permissions.iter().filter(|p| !role.permissions.contains(p)).collect();
    if !added.is_empty() {
        details["permissions_added"] = json!(added);
    }
    if !removed.is_empty() {
        details["permissions_removed"] = json!(removed);
    }
    activity::record(&state.db, &user, "users", "edited role", None, &role.name, Some(details)).await;
    Ok(Json(find_role(&state.db, id).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("roles.delete")?;
    let before = find_role(&state.db, id).await?;
    require_cover(&user, before.super_user, &before.permissions)?;

    let mut tx = state.db.begin().await?;
    sqlx::query("DELETE FROM roles WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    ensure_super_user_left(&mut tx, &user).await?;
    tx.commit().await?;

    let details = json!({ "users": before.users, "super_user": before.super_user, "permissions": before.permissions });
    activity::record(&state.db, &user, "users", "deleted role", None, &before.name, Some(details)).await;
    Ok(StatusCode::NO_CONTENT)
}
