//! Notifications that pop up in the panel: each user's own unread ones.

use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::state::AppState;

const PAGE_SIZE: i64 = 30;

#[derive(Serialize, sqlx::FromRow)]
pub struct Notice {
    id: i64,
    kind: String,
    title: String,
    body: String,
    tone: String,
    path: Option<String>,
    important: bool,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct Summary {
    unread: i64,
}

#[derive(Deserialize)]
pub struct ReadBody {
    /// The notifications to mark read.
    ids: Vec<i64>,
}

/// How many are unread. The panel asks every half minute, so this stays cheap.
pub async fn count(State(state): State<AppState>, user: CurrentUser) -> Result<Json<Summary>, ApiError> {
    let unread: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM panel_notifications WHERE user_id = $1 AND read_at IS NULL")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(Summary { unread }))
}

/// The newest unread notifications.
pub async fn unread(State(state): State<AppState>, user: CurrentUser) -> Result<Json<Vec<Notice>>, ApiError> {
    let items: Vec<Notice> = sqlx::query_as(
        r#"
        SELECT id, kind, title, body, tone, path, important, created_at
        FROM panel_notifications
        WHERE user_id = $1 AND read_at IS NULL
        ORDER BY id DESC
        LIMIT $2
        "#,
    )
    .bind(user.id)
    .bind(PAGE_SIZE)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
}

pub async fn mark_read(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<ReadBody>,
) -> Result<Json<Summary>, ApiError> {
    sqlx::query("UPDATE panel_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2)")
        .bind(user.id)
        .bind(&body.ids)
        .execute(&state.db)
        .await?;
    count(State(state), user).await
}
