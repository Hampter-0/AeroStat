use axum::body::{Body, Bytes};
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;

use crate::activity;
use crate::auth::{self, CurrentUser};
use crate::error::ApiError;
use crate::state::AppState;

use super::users::{validate_password, validate_username};

const MAX_AVATAR_BYTES: usize = 1024 * 1024;
const AVATAR_TYPES: [&str; 4] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

#[derive(Deserialize)]
pub struct ProfileBody {
    username: String,
    email: Option<String>,
}

#[derive(Deserialize)]
pub struct PasswordBody {
    current_password: String,
    new_password: String,
}

pub(super) fn clean_email(email: Option<String>) -> Result<Option<String>, ApiError> {
    let email = match email.map(|e| e.trim().to_string()).filter(|e| !e.is_empty()) {
        Some(e) => e,
        None => return Ok(None),
    };
    let valid = email.len() <= 254
        && !email.contains(char::is_whitespace)
        && email
            .split_once('@')
            .map(|(local, domain)| !local.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.'))
            .unwrap_or(false);
    if !valid {
        return Err(ApiError::BadRequest("Enter a valid email address".into()));
    }
    Ok(Some(email))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<ProfileBody>,
) -> Result<Json<CurrentUser>, ApiError> {
    let username = body.username.trim().to_lowercase();
    validate_username(&username)?;
    let email = clean_email(body.email)?;
    let before = activity::snapshot(&state.db, "users", &user.id.to_string()).await;

    let result = sqlx::query("UPDATE users SET username = $1, email = $2 WHERE id = $3")
        .bind(&username)
        .bind(&email)
        .bind(user.id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => {
            let updated = auth::load_user(&state.db, user.id).await?;
            if updated.username != user.username || updated.email != user.email {
                let details = activity::changes(before, activity::snapshot(&state.db, "users", &user.id.to_string()).await);
                activity::record(&state.db, &updated, "account", "updated their profile", None, "", details).await;
            }
            Ok(Json(updated))
        }
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            let constraint = e.constraint().unwrap_or("");
            if constraint.contains("email") {
                Err(ApiError::Conflict("That email address is already used by another account".into()))
            } else {
                Err(ApiError::Conflict(format!("Username '{username}' is already taken")))
            }
        }
        Err(e) => Err(e.into()),
    }
}

/// Changes the password and signs out every other session of this user.
pub async fn change_password(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Json(body): Json<PasswordBody>,
) -> Result<StatusCode, ApiError> {
    let (hash,): (String,) = sqlx::query_as("SELECT password_hash FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    if !auth::verify_password(body.current_password, hash).await {
        return Err(ApiError::BadRequest("Your current password is not correct".into()));
    }
    validate_password(&body.new_password)?;

    let new_hash = auth::hash_password(body.new_password).await?;
    let current_session = auth::bearer_token(&headers).map(|token| auth::hash_token(&token)).unwrap_or_default();

    let mut tx = state.db.begin().await?;
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(user.id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2")
        .bind(user.id)
        .bind(&current_session)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    activity::record(&state.db, &user, "account", "changed their password", None, "", None).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn upload_avatar(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or("").trim().to_lowercase())
        .unwrap_or_default();
    if !AVATAR_TYPES.contains(&content_type.as_str()) {
        return Err(ApiError::BadRequest("Upload a PNG, JPG, WebP or GIF image".into()));
    }
    if body.is_empty() {
        return Err(ApiError::BadRequest("The file is empty".into()));
    }
    if body.len() > MAX_AVATAR_BYTES {
        return Err(ApiError::BadRequest("The file can be at most 1 MB".into()));
    }

    sqlx::query("UPDATE users SET avatar = $1, avatar_type = $2, avatar_updated_at = now() WHERE id = $3")
        .bind(body.as_ref())
        .bind(&content_type)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_avatar(State(state): State<AppState>, user: CurrentUser) -> Result<StatusCode, ApiError> {
    sqlx::query("UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_updated_at = NULL WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Avatars are only shown inside the panel, so any signed-in user may load them.
pub async fn avatar(
    State(state): State<AppState>,
    _user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Response, ApiError> {
    let row: Option<(Option<Vec<u8>>, Option<String>)> =
        sqlx::query_as("SELECT avatar, avatar_type FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?;
    let (data, content_type) = match row {
        Some((Some(data), Some(content_type))) => (data, content_type),
        _ => return Err(ApiError::NotFound),
    };

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, content_type),
            (header::CACHE_CONTROL, "private, max-age=300".to_string()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_string()),
        ],
        Body::from(data),
    )
        .into_response())
}
