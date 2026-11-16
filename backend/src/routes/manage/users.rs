use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, Postgres, Transaction};

use crate::activity;
use crate::auth::{self, CurrentUser, PermissionGroup, PERMISSION_GROUPS};
use crate::error::ApiError;
use crate::state::AppState;

use super::roles::{self, RoleSummary};

const MIN_PASSWORD_LENGTH: usize = 8;

#[derive(Serialize, sqlx::FromRow)]
pub struct UserRow {
    id: i64,
    username: String,
    email: Option<String>,
    is_admin: bool,
    role_ids: Vec<i64>,
    /// Super user on its own, not through a role.
    super_user: bool,
    /// Given to this user directly, on top of their roles.
    permissions: Vec<String>,
    created_at: DateTime<Utc>,
    last_login_at: Option<DateTime<Utc>>,
    avatar_version: Option<i64>,
}

const USER_COLUMNS: &str = "u.id, u.username, u.email, user_is_super(u.id) AS is_admin, \
     ARRAY(SELECT role_id FROM user_roles WHERE user_id = u.id ORDER BY role_id) AS role_ids, \
     u.super_user, u.permissions, u.created_at, u.last_login_at, \
     EXTRACT(EPOCH FROM u.avatar_updated_at)::bigint AS avatar_version";

#[derive(Serialize)]
pub struct UsersResponse {
    users: Vec<UserRow>,
    roles: Vec<RoleSummary>,
    permission_groups: &'static [PermissionGroup],
}

#[derive(Deserialize)]
pub struct CreateUser {
    username: String,
    password: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    role_ids: Vec<i64>,
    #[serde(default)]
    super_user: bool,
    #[serde(default)]
    permissions: Vec<String>,
}

#[derive(Deserialize)]
pub struct UpdateUser {
    role_ids: Option<Vec<i64>>,
    super_user: Option<bool>,
    permissions: Option<Vec<String>>,
    password: Option<String>,
    /// Missing keeps the address, an empty string removes it.
    email: Option<String>,
}

/// Checks and completes permissions given straight to a user; nobody can hand
/// out what they don't have themselves.
fn direct_permissions(actor: &CurrentUser, permissions: &[String]) -> Result<Vec<String>, ApiError> {
    let permissions = auth::normalize_permissions(permissions)?;
    if !actor.covers(false, &permissions) {
        return Err(ApiError::BadRequest("You can't give permissions you don't have yourself".into()));
    }
    Ok(permissions)
}

fn require_super_to_change(actor: &CurrentUser) -> Result<(), ApiError> {
    if !actor.is_admin {
        return Err(ApiError::BadRequest("Only a super user can make someone a super user".into()));
    }
    Ok(())
}

fn email_taken() -> ApiError {
    ApiError::Conflict("That email address is already used by another account".into())
}

pub(super) fn validate_username(username: &str) -> Result<(), ApiError> {
    let valid_chars = username
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '_' || c == '-');
    if username.len() < 2 || username.len() > 32 || !valid_chars {
        return Err(ApiError::BadRequest(
            "Username must be 2-32 characters: lowercase letters, digits, '.', '_' or '-'".into(),
        ));
    }
    Ok(())
}

pub(super) fn validate_password(password: &str) -> Result<(), ApiError> {
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )));
    }
    Ok(())
}

async fn find_user(db: &PgPool, id: i64) -> Result<UserRow, ApiError> {
    let query = format!("SELECT {USER_COLUMNS} FROM users u WHERE u.id = $1");
    let user: Option<UserRow> = sqlx::query_as(&query).bind(id).fetch_optional(db).await?;
    user.ok_or(ApiError::NotFound)
}

async fn role_names(db: &PgPool, user_id: i64) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.name",
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Someone who isn't a super user can only manage users that have no more
/// rights than they have themselves.
async fn require_reach(db: &PgPool, actor: &CurrentUser, target_id: i64) -> Result<(), ApiError> {
    let (is_super, permissions): (bool, Vec<String>) =
        sqlx::query_as("SELECT user_is_super($1), user_permissions($1)")
            .bind(target_id)
            .fetch_one(db)
            .await?;
    if !actor.covers(is_super, &permissions) {
        return Err(ApiError::BadRequest(
            "This user has rights you don't have, so you can't change their account".into(),
        ));
    }
    Ok(())
}

/// Checks the roles exist and that the actor may hand them out.
async fn assignable_roles(db: &PgPool, actor: &CurrentUser, ids: &[i64]) -> Result<Vec<i64>, ApiError> {
    let mut unique: Vec<i64> = ids.to_vec();
    unique.sort();
    unique.dedup();
    let found = roles::summaries(db, &unique).await?;
    if found.len() != unique.len() {
        return Err(ApiError::BadRequest("One or more roles don't exist".into()));
    }
    for role in &found {
        if !actor.covers(role.super_user, &role.permissions) {
            return Err(ApiError::BadRequest(format!(
                "You can't give the role '{}', it has rights you don't have",
                role.name
            )));
        }
    }
    Ok(unique)
}

async fn set_roles(tx: &mut Transaction<'_, Postgres>, user_id: i64, role_ids: &[i64]) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM user_roles WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query("INSERT INTO user_roles (user_id, role_id) SELECT $1, unnest($2::bigint[])")
        .bind(user_id)
        .bind(role_ids)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Run inside the transaction of any change to users or roles, before commit.
pub(super) async fn ensure_super_user_left(tx: &mut Transaction<'_, Postgres>, actor: &CurrentUser) -> Result<(), ApiError> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE user_is_super(id)")
        .fetch_one(&mut **tx)
        .await?;
    if count == 0 {
        return Err(ApiError::BadRequest("There must always be at least one super user".into()));
    }
    if actor.is_admin {
        let (still_super,): (bool,) = sqlx::query_as("SELECT user_is_super($1)")
            .bind(actor.id)
            .fetch_one(&mut **tx)
            .await?;
        if !still_super {
            return Err(ApiError::BadRequest("You can't take away your own super user rights".into()));
        }
    }
    Ok(())
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<UsersResponse>, ApiError> {
    user.require("users.view")?;

    let query = format!("SELECT {USER_COLUMNS} FROM users u ORDER BY u.username");
    let users: Vec<UserRow> = sqlx::query_as(&query).fetch_all(&state.db).await?;
    let roles = roles::all_summaries(&state.db).await?;

    Ok(Json(UsersResponse {
        users,
        roles,
        permission_groups: PERMISSION_GROUPS,
    }))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<CreateUser>,
) -> Result<(StatusCode, Json<UserRow>), ApiError> {
    user.require("users.create")?;

    let username = body.username.trim().to_lowercase();
    validate_username(&username)?;
    validate_password(&body.password)?;
    let email = super::profile::clean_email(body.email)?;
    let role_ids = assignable_roles(&state.db, &user, &body.role_ids).await?;
    let permissions = direct_permissions(&user, &body.permissions)?;
    if body.super_user {
        require_super_to_change(&user)?;
    }

    let password_hash = auth::hash_password(body.password).await?;

    let mut tx = state.db.begin().await?;
    let created: Result<(i64,), sqlx::Error> = sqlx::query_as(
        "INSERT INTO users (username, password_hash, email, permissions, super_user) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(&username)
    .bind(&password_hash)
    .bind(&email)
    .bind(&permissions)
    .bind(body.super_user)
    .fetch_one(&mut *tx)
    .await;
    let id = match created {
        Ok((id,)) => id,
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            if e.constraint().unwrap_or("").contains("email") {
                return Err(email_taken());
            }
            return Err(ApiError::Conflict(format!("Username '{username}' is already taken")));
        }
        Err(e) => return Err(e.into()),
    };
    set_roles(&mut tx, id, &role_ids).await?;
    tx.commit().await?;

    let details = json!({
        "email": email,
        "roles": role_names(&state.db, id).await,
        "super_user": body.super_user,
        "permissions": permissions,
    });
    activity::record(&state.db, &user, "users", "created user", None, &username, Some(details)).await;
    Ok((StatusCode::CREATED, Json(find_user(&state.db, id).await?)))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<UpdateUser>,
) -> Result<Json<UserRow>, ApiError> {
    user.require("users.edit")?;
    let target = find_user(&state.db, id).await?;
    require_reach(&state.db, &user, id).await?;

    let roles_before = role_names(&state.db, id).await;
    let mut details = json!({});

    let role_ids = match &body.role_ids {
        Some(ids) => Some(assignable_roles(&state.db, &user, ids).await?),
        None => None,
    };
    let permissions = match &body.permissions {
        Some(list) => Some(direct_permissions(&user, list)?),
        None => None,
    };
    let super_change = body.super_user.filter(|value| *value != target.super_user);
    if super_change.is_some() {
        require_super_to_change(&user)?;
    }
    let email = match body.email {
        Some(text) => Some(super::profile::clean_email(Some(text))?),
        None => None,
    };
    let password_hash = match body.password {
        Some(password) => {
            validate_password(&password)?;
            Some(auth::hash_password(password).await?)
        }
        None => None,
    };

    let mut tx = state.db.begin().await?;

    if let Some(email) = &email {
        let result = sqlx::query("UPDATE users SET email = $1 WHERE id = $2")
            .bind(email)
            .bind(id)
            .execute(&mut *tx)
            .await;
        match result {
            Ok(_) => {}
            Err(sqlx::Error::Database(e)) if e.is_unique_violation() => return Err(email_taken()),
            Err(e) => return Err(e.into()),
        }
        if *email != target.email {
            details["email"] = json!({ "from": target.email, "to": email });
        }
    }

    if let Some(role_ids) = &role_ids {
        set_roles(&mut tx, id, role_ids).await?;
    }
    if let Some(super_user) = super_change {
        sqlx::query("UPDATE users SET super_user = $1 WHERE id = $2")
            .bind(super_user)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        details["super_user"] = json!({ "from": target.super_user, "to": super_user });
    }
    if role_ids.is_some() || super_change.is_some() {
        ensure_super_user_left(&mut tx, &user).await?;
    }

    if let Some(permissions) = &permissions {
        sqlx::query("UPDATE users SET permissions = $1 WHERE id = $2")
            .bind(permissions)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        let added: Vec<&String> = permissions.iter().filter(|p| !target.permissions.contains(p)).collect();
        let removed: Vec<&String> = target.permissions.iter().filter(|p| !permissions.contains(p)).collect();
        if !added.is_empty() {
            details["permissions_added"] = json!(added);
        }
        if !removed.is_empty() {
            details["permissions_removed"] = json!(removed);
        }
    }

    if let Some(hash) = &password_hash {
        sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
            .bind(hash)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        if id != user.id {
            sqlx::query("DELETE FROM sessions WHERE user_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        details["password_changed"] = json!(true);
    }

    tx.commit().await?;

    let roles_after = role_names(&state.db, id).await;
    if roles_after != roles_before {
        details["roles"] = json!({ "from": roles_before, "to": roles_after });
    }
    activity::record(&state.db, &user, "users", "edited user", None, &target.username, Some(details)).await;
    Ok(Json(find_user(&state.db, id).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("users.delete")?;
    let target = find_user(&state.db, id).await?;

    if target.id == user.id {
        return Err(ApiError::BadRequest("You can't delete your own account".into()));
    }
    require_reach(&state.db, &user, id).await?;
    let roles_before = role_names(&state.db, id).await;

    let mut tx = state.db.begin().await?;
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    ensure_super_user_left(&mut tx, &user).await?;
    tx.commit().await?;

    let details = json!({ "email": target.email, "roles": roles_before });
    activity::record(&state.db, &user, "users", "deleted user", None, &target.username, Some(details)).await;
    Ok(StatusCode::NO_CONTENT)
}

/// The first super user role, made when none exists yet.
async fn super_role(pool: &PgPool) -> anyhow::Result<i64> {
    let existing: Option<i64> = sqlx::query_scalar("SELECT id FROM roles WHERE super_user ORDER BY id LIMIT 1")
        .fetch_optional(pool)
        .await?;
    if let Some(id) = existing {
        return Ok(id);
    }
    let id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO roles (name, handle, super_user)
        SELECT 'Admin', CASE WHEN EXISTS (SELECT 1 FROM roles WHERE handle = 'admin') THEN 'super-admin' ELSE 'admin' END, true
        RETURNING id
        "#,
    )
    .fetch_one(pool)
    .await?;
    Ok(id)
}

pub async fn create_admin_from_cli(pool: &sqlx::PgPool, username: &str, password: String) -> anyhow::Result<()> {
    let username = username.trim().to_lowercase();
    validate_username(&username).map_err(|e| anyhow::anyhow!(error_text(e)))?;
    validate_password(&password).map_err(|e| anyhow::anyhow!(error_text(e)))?;

    let password_hash = auth::hash_password(password).await?;
    let id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
        RETURNING id
        "#,
    )
    .bind(&username)
    .bind(&password_hash)
    .fetch_one(pool)
    .await?;

    let role = super_role(pool).await?;
    sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(id)
        .bind(role)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn reset_password_from_cli(pool: &sqlx::PgPool, username: &str, password: String) -> anyhow::Result<()> {
    let username = username.trim().to_lowercase();
    validate_password(&password).map_err(|e| anyhow::anyhow!(error_text(e)))?;

    let user: Option<(i64,)> = sqlx::query_as("SELECT id FROM users WHERE username = $1 OR lower(email) = $1")
        .bind(&username)
        .fetch_optional(pool)
        .await?;
    let (id,) = user.ok_or_else(|| anyhow::anyhow!("No account with username or email '{username}'"))?;

    let password_hash = auth::hash_password(password).await?;
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&password_hash)
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

fn error_text(error: ApiError) -> String {
    match error {
        ApiError::BadRequest(message) | ApiError::Conflict(message) => message,
        other => format!("{other:?}"),
    }
}
