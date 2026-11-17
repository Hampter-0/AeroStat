//! The bell in the panel: each user's own notifications, read state and mute.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::state::AppState;

const PAGE_SIZE: i64 = 30;

#[derive(Serialize, sqlx::FromRow)]
pub struct Notification {
    id: i64,
    kind: String,
    title: String,
    body: String,
    tone: String,
    path: Option<String>,
    important: bool,
    read: bool,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct Summary {
    unread: i64,
    unread_important: i64,
    muted_until: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct ListResponse {
    items: Vec<Notification>,
    #[serde(flatten)]
    summary: Summary,
    /// Pass as `before` to load the next page; None when there is no more.
    next_before: Option<i64>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    /// "all", "unread" or "important".
    filter: Option<String>,
    before: Option<i64>,
}

#[derive(Deserialize)]
pub struct ReadBody {
    /// The notifications to mark read; all of them when left out.
    ids: Option<Vec<i64>>,
}

#[derive(Deserialize)]
pub struct MuteBody {
    /// Until when the count stays hidden; None to unmute.
    until: Option<DateTime<Utc>>,
}

async fn summary(state: &AppState, user_id: i64) -> Result<Summary, ApiError> {
    let (unread, unread_important, muted_until): (i64, i64, Option<DateTime<Utc>>) = sqlx::query_as(
        r#"
        SELECT
            (SELECT COUNT(*) FROM panel_notifications WHERE user_id = $1 AND read_at IS NULL),
            (SELECT COUNT(*) FROM panel_notifications WHERE user_id = $1 AND read_at IS NULL AND important),
            (SELECT panel_muted_until FROM users WHERE id = $1 AND panel_muted_until > now())
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Summary {
        unread,
        unread_important,
        muted_until,
    })
}

/// Just the counts, for the badge. The panel asks for this every half minute.
pub async fn count(State(state): State<AppState>, user: CurrentUser) -> Result<Json<Summary>, ApiError> {
    Ok(Json(summary(&state, user.id).await?))
}

pub async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>, ApiError> {
    let filter = query.filter.unwrap_or_else(|| "all".to_string());
    if !["all", "unread", "important"].contains(&filter.as_str()) {
        return Err(ApiError::BadRequest(format!("Unknown filter: {filter}")));
    }
    let mut items: Vec<Notification> = sqlx::query_as(
        r#"
        SELECT id, kind, title, body, tone, path, important, read_at IS NOT NULL AS read, created_at
        FROM panel_notifications
        WHERE user_id = $1
          AND ($2 = 'all' OR ($2 = 'unread' AND read_at IS NULL) OR ($2 = 'important' AND important))
          AND ($3::bigint IS NULL OR id < $3)
        ORDER BY id DESC
        LIMIT $4
        "#,
    )
    .bind(user.id)
    .bind(&filter)
    .bind(query.before)
    .bind(PAGE_SIZE + 1)
    .fetch_all(&state.db)
    .await?;

    let mut next_before = None;
    if items.len() as i64 > PAGE_SIZE {
        items.truncate(PAGE_SIZE as usize);
        next_before = items.last().map(|item| item.id);
    }
    Ok(Json(ListResponse {
        items,
        summary: summary(&state, user.id).await?,
        next_before,
    }))
}

pub async fn mark_read(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<ReadBody>,
) -> Result<Json<Summary>, ApiError> {
    sqlx::query(
        r#"
        UPDATE panel_notifications SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL AND ($2::bigint[] IS NULL OR id = ANY($2))
        "#,
    )
    .bind(user.id)
    .bind(body.ids)
    .execute(&state.db)
    .await?;
    Ok(Json(summary(&state, user.id).await?))
}

pub async fn clear(State(state): State<AppState>, user: CurrentUser) -> Result<Json<Summary>, ApiError> {
    sqlx::query("DELETE FROM panel_notifications WHERE user_id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;
    Ok(Json(summary(&state, user.id).await?))
}

pub async fn remove(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    let removed = sqlx::query("DELETE FROM panel_notifications WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .execute(&state.db)
        .await?
        .rows_affected();
    if removed == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn mute(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<MuteBody>,
) -> Result<Json<Summary>, ApiError> {
    if let Some(until) = body.until {
        if until <= Utc::now() || until > Utc::now() + chrono::Duration::days(7) {
            return Err(ApiError::BadRequest("Mute for up to a week".into()));
        }
    }
    sqlx::query("UPDATE users SET panel_muted_until = $1 WHERE id = $2")
        .bind(body.until)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    Ok(Json(summary(&state, user.id).await?))
}
