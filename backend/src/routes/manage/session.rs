use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::activity;
use crate::auth::{self, CurrentUser};
use crate::error::ApiError;
use crate::login_guard;
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
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    let login = body.username.trim().to_lowercase();
    let ip = login_guard::client_ip(&headers);
    let details = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(|agent| serde_json::json!({ "user_agent": agent }));

    let query = if login.contains('@') {
        "SELECT id, password_hash FROM users WHERE lower(email) = $1"
    } else {
        "SELECT id, password_hash FROM users WHERE username = $1"
    };
    let row: Option<LoginRow> = sqlx::query_as(query)
        .bind(&login)
        .fetch_optional(&state.db)
        .await?;

    let limits = state.login_limits;
    let account = login_guard::account_key(row.as_ref().map(|row| row.id), &login);
    login_guard::check(&state.redis, &limits, &ip, &account).await?;

    let (found_id, hash) = match row {
        Some(row) => (Some(row.id), row.password_hash),
        None => (None, auth::dummy_hash()),
    };
    let valid = auth::verify_password(body.password, hash).await;
    let user_id = match found_id {
        Some(id) if valid => id,
        _ => {
            if login_guard::record_failure(&state.redis, &limits, &ip, &account).await {
                activity::record_account(&state.db, found_id, &login, "was blocked after too many failed sign-ins", &ip, details).await;
            }
            return Err(ApiError::BadRequest("Invalid username, email or password".into()));
        }
    };
    login_guard::clear_account(&state.redis, &account).await;

    sqlx::query("DELETE FROM sessions WHERE expires_at <= now()")
        .execute(&state.db)
        .await?;

    let (token, token_hash) = auth::new_session_token();
    let (expires_at,): (DateTime<Utc>,) = sqlx::query_as(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING expires_at",
    )
    .bind(&token_hash)
    .bind(user_id)
    .bind(state.session_days)
    .fetch_one(&state.db)
    .await?;

    let user = auth::load_user(&state.db, user_id).await?;
    activity::record_account(&state.db, Some(user.id), &user.username, "signed in", &ip, details).await;

    Ok(Json(LoginResponse { token, expires_at, user }))
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
