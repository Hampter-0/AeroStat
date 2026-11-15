use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::activity;
use crate::auth::{self, CurrentUser, PERMISSIONS};
use crate::error::ApiError;
use crate::state::AppState;

const MIN_PASSWORD_LENGTH: usize = 8;

#[derive(Serialize, sqlx::FromRow)]
pub struct UserRow {
    id: i64,
    username: String,
    email: Option<String>,
    is_admin: bool,
    permissions: Vec<String>,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct UsersResponse {
    users: Vec<UserRow>,
    available_permissions: Vec<&'static str>,
}

#[derive(Deserialize)]
pub struct CreateUser {
    username: String,
    password: String,
    #[serde(default)]
    is_admin: bool,
    #[serde(default)]
    permissions: Vec<String>,
}

#[derive(Deserialize)]
pub struct UpdateUser {
    is_admin: Option<bool>,
    permissions: Option<Vec<String>>,
    password: Option<String>,
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

async fn admin_count(state: &AppState) -> Result<i64, ApiError> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE is_admin")
        .fetch_one(&state.db)
        .await?;
    Ok(count)
}

async fn find_user(state: &AppState, id: i64) -> Result<UserRow, ApiError> {
    let user: Option<UserRow> = sqlx::query_as(
        "SELECT id, username, email, is_admin, permissions, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;
    user.ok_or(ApiError::NotFound)
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<UsersResponse>, ApiError> {
    user.require_admin()?;

    let users: Vec<UserRow> = sqlx::query_as(
        "SELECT id, username, email, is_admin, permissions, created_at FROM users ORDER BY username",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(UsersResponse {
        users,
        available_permissions: PERMISSIONS.to_vec(),
    }))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<CreateUser>,
) -> Result<(StatusCode, Json<UserRow>), ApiError> {
    user.require_admin()?;

    let username = body.username.trim().to_lowercase();
    validate_username(&username)?;
    validate_password(&body.password)?;
    auth::validate_permissions(&body.permissions)?;

    let password_hash = auth::hash_password(body.password).await?;

    let created: Result<UserRow, sqlx::Error> = sqlx::query_as(
        r#"
        INSERT INTO users (username, password_hash, is_admin, permissions)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, is_admin, permissions, created_at
        "#,
    )
    .bind(&username)
    .bind(&password_hash)
    .bind(body.is_admin)
    .bind(&body.permissions)
    .fetch_one(&state.db)
    .await;

    match created {
        Ok(row) => {
            let details = activity::created(activity::snapshot(&state.db, "users", &row.id.to_string()).await);
            activity::record(&state.db, &user, "users", "created user", None, &row.username, details).await;
            Ok((StatusCode::CREATED, Json(row)))
        }
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(ApiError::Conflict(format!("Username '{username}' is already taken")))
        }
        Err(e) => Err(e.into()),
    }
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<UpdateUser>,
) -> Result<Json<UserRow>, ApiError> {
    user.require_admin()?;
    let target = find_user(&state, id).await?;
    let before = activity::snapshot(&state.db, "users", &id.to_string()).await;
    let password_changed = body.password.is_some();

    if let Some(is_admin) = body.is_admin {
        if target.is_admin && !is_admin {
            if target.id == user.id {
                return Err(ApiError::BadRequest("You can't remove your own admin rights".into()));
            }
            if admin_count(&state).await? <= 1 {
                return Err(ApiError::BadRequest("There must always be at least one admin".into()));
            }
        }
        sqlx::query("UPDATE users SET is_admin = $1 WHERE id = $2")
            .bind(is_admin)
            .bind(id)
            .execute(&state.db)
            .await?;
    }

    if let Some(permissions) = body.permissions {
        auth::validate_permissions(&permissions)?;
        sqlx::query("UPDATE users SET permissions = $1 WHERE id = $2")
            .bind(&permissions)
            .bind(id)
            .execute(&state.db)
            .await?;
    }

    if let Some(password) = body.password {
        validate_password(&password)?;
        let password_hash = auth::hash_password(password).await?;
        sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
            .bind(&password_hash)
            .bind(id)
            .execute(&state.db)
            .await?;
        if id != user.id {
            sqlx::query("DELETE FROM sessions WHERE user_id = $1")
                .bind(id)
                .execute(&state.db)
                .await?;
        }
    }

    let after = activity::snapshot(&state.db, "users", &id.to_string()).await;
    let mut details = activity::changes(before, after).unwrap_or_else(|| serde_json::json!({}));
    if password_changed {
        details["password_changed"] = serde_json::json!(true);
    }
    activity::record(&state.db, &user, "users", "edited user", None, &target.username, Some(details)).await;
    Ok(Json(find_user(&state, id).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require_admin()?;
    let target = find_user(&state, id).await?;

    if target.id == user.id {
        return Err(ApiError::BadRequest("You can't delete your own account".into()));
    }
    if target.is_admin && admin_count(&state).await? <= 1 {
        return Err(ApiError::BadRequest("There must always be at least one admin".into()));
    }
    let before = activity::snapshot(&state.db, "users", &id.to_string()).await;

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    activity::record(&state.db, &user, "users", "deleted user", None, &target.username, activity::deleted(before)).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_admin_from_cli(pool: &sqlx::PgPool, username: &str, password: String) -> anyhow::Result<()> {
    let username = username.trim().to_lowercase();
    validate_username(&username).map_err(|e| anyhow::anyhow!(error_text(e)))?;
    validate_password(&password).map_err(|e| anyhow::anyhow!(error_text(e)))?;

    let password_hash = auth::hash_password(password).await?;
    sqlx::query(
        r#"
        INSERT INTO users (username, password_hash, is_admin)
        VALUES ($1, $2, true)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = true
        "#,
    )
    .bind(&username)
    .bind(&password_hash)
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
