use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::json;

use crate::activity;
use crate::auth::{self, CurrentUser};
use crate::error::ApiError;
use crate::state::AppState;

#[derive(Serialize, sqlx::FromRow)]
pub struct SessionView {
    id: i64,
    ip: Option<String>,
    user_agent: Option<String>,
    created_at: DateTime<Utc>,
    last_used_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    current: bool,
}

#[derive(Serialize)]
pub struct LoggedOut {
    count: u64,
}

fn current_hash(headers: &HeaderMap) -> String {
    auth::bearer_token(headers).map(|token| auth::hash_token(&token)).unwrap_or_default()
}

/// The signed-in user's own sessions, most recently used first.
pub async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
) -> Result<Json<Vec<SessionView>>, ApiError> {
    let sessions = sqlx::query_as(
        r#"
        SELECT id, ip, user_agent, created_at, last_used_at, expires_at, token_hash = $2 AS current
        FROM sessions
        WHERE user_id = $1 AND expires_at > now()
        ORDER BY token_hash = $2 DESC, last_used_at DESC
        "#,
    )
    .bind(user.id)
    .bind(current_hash(&headers))
    .fetch_all(&state.db)
    .await?;
    Ok(Json(sessions))
}

/// Signs out one of the user's other devices.
pub async fn end(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    let found: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT token_hash, ip FROM sessions WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(user.id)
            .fetch_optional(&state.db)
            .await?;
    let Some((token_hash, ip)) = found else {
        return Err(ApiError::NotFound);
    };
    if token_hash == current_hash(&headers) {
        return Err(ApiError::BadRequest("This is the device you're using. Sign out with the button in the sidebar.".into()));
    }
    sqlx::query("DELETE FROM sessions WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    activity::record(&state.db, &user, "account", "signed out a session", None, "", Some(json!({ "ip": ip }))).await;
    Ok(StatusCode::NO_CONTENT)
}

/// Signs out every device except the one making the request.
pub async fn end_others(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
) -> Result<Json<LoggedOut>, ApiError> {
    let result = sqlx::query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2")
        .bind(user.id)
        .bind(current_hash(&headers))
        .execute(&state.db)
        .await?;
    let count = result.rows_affected();
    if count > 0 {
        activity::record(
            &state.db,
            &user,
            "account",
            "signed out all other sessions",
            None,
            "",
            Some(json!({ "sessions": count })),
        )
        .await;
    }
    Ok(Json(LoggedOut { count }))
}
