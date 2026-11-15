use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::auth::{self, CurrentUser, SESSION_DAYS};
use crate::error::ApiError;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    token: String,
    expires_at: DateTime<Utc>,
    user: CurrentUser,
}

#[derive(sqlx::FromRow)]
struct LoginRow {
    id: i64,
    password_hash: String,
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    let login = body.username.trim().to_lowercase();

    let query = if login.contains('@') {
        "SELECT id, password_hash FROM users WHERE lower(email) = $1"
    } else {
        "SELECT id, password_hash FROM users WHERE username = $1"
    };
    let row: Option<LoginRow> = sqlx::query_as(query)
        .bind(&login)
        .fetch_optional(&state.db)
        .await?;

    let invalid = || ApiError::BadRequest("Invalid username, email or password".into());
    let row = row.ok_or_else(invalid)?;
    if !auth::verify_password(body.password, row.password_hash.clone()).await {
        return Err(invalid());
    }

    sqlx::query("DELETE FROM sessions WHERE expires_at <= now()")
        .execute(&state.db)
        .await?;

    let (token, token_hash) = auth::new_session_token();
    let (expires_at,): (DateTime<Utc>,) = sqlx::query_as(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING expires_at",
    )
    .bind(&token_hash)
    .bind(row.id)
    .bind(SESSION_DAYS)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(LoginResponse {
        token,
        expires_at,
        user: auth::load_user(&state.db, row.id).await?,
    }))
}

pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<StatusCode, ApiError> {
    if let Some(token) = auth::bearer_token(&headers) {
        sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
            .bind(auth::hash_token(&token))
            .execute(&state.db)
            .await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn me(user: CurrentUser) -> Json<CurrentUser> {
    Json(user)
}
