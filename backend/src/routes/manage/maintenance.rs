use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::activity;
use crate::auth::CurrentUser;
use crate::notifications::{self, Event};
use crate::error::ApiError;
use crate::models::StatusUpdate;
use crate::state::AppState;

const PERMISSION: &str = "maintenance";
const UPDATE_STATUSES: [&str; 4] = ["scheduled", "in_progress", "completed", "cancelled"];
const DEFAULT_SCHEDULED_MESSAGE: &str = "Maintenance has been scheduled.";
const DEFAULT_CANCELLED_MESSAGE: &str = "This maintenance has been cancelled.";
const DEFAULT_REACTIVATED_MESSAGE: &str = "This maintenance is back on.";

#[derive(Deserialize)]
pub struct MaintenanceBody {
    title: String,
    description: Option<String>,
    affected_services: Vec<String>,
    scheduled_start: DateTime<Utc>,
    scheduled_end: DateTime<Utc>,
    #[serde(default)]
    message: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateBody {
    status: String,
    message: String,
}

#[derive(Deserialize)]
pub struct CancelBody {
    #[serde(default)]
    message: Option<String>,
}

#[derive(serde::Serialize)]
pub struct Created {
    id: i64,
}

fn clean_title(title: &str) -> Result<String, ApiError> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(ApiError::BadRequest("Title must be 1-200 characters".into()));
    }
    Ok(title.to_string())
}

fn clean_optional(text: Option<String>) -> Option<String> {
    text.map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn clean_message(message: &str) -> Result<String, ApiError> {
    let message = message.trim();
    if message.is_empty() {
        return Err(ApiError::BadRequest("Message can't be empty".into()));
    }
    Ok(message.to_string())
}

fn check_window(start: DateTime<Utc>, end: DateTime<Utc>) -> Result<(), ApiError> {
    if end <= start {
        return Err(ApiError::BadRequest("The end time must be after the start time".into()));
    }
    Ok(())
}

fn check_status(status: &str) -> Result<(), ApiError> {
    if UPDATE_STATUSES.contains(&status) {
        return Ok(());
    }
    Err(ApiError::BadRequest(format!("Unknown status: {status}")))
}

async fn check_services(db: &PgPool, ids: &[String]) -> Result<(), ApiError> {
    if ids.is_empty() {
        return Err(ApiError::BadRequest("Pick at least one affected service".into()));
    }
    let (known,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM services WHERE id = ANY($1)")
        .bind(ids)
        .fetch_one(db)
        .await?;
    if known as usize != ids.len() {
        return Err(ApiError::BadRequest("One or more services don't exist".into()));
    }
    Ok(())
}

async fn find_title(db: &PgPool, id: i64) -> Result<String, ApiError> {
    let found: Option<(String,)> = sqlx::query_as("SELECT title FROM maintenance WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await?;
    found.map(|(title,)| title).ok_or(ApiError::NotFound)
}

async fn log(state: &AppState, user: &CurrentUser, action: &str, id: Option<i64>, title: &str, details: Option<Value>) {
    activity::record(&state.db, user, PERMISSION, action, id.map(|id| id.to_string()), title, details).await;
}

async fn snapshot(state: &AppState, table: &str, id: i64) -> Option<Value> {
    activity::snapshot(&state.db, table, &id.to_string()).await
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<MaintenanceBody>,
) -> Result<(StatusCode, Json<Created>), ApiError> {
    user.require("maintenance.create")?;
    let title = clean_title(&body.title)?;
    check_window(body.scheduled_start, body.scheduled_end)?;
    check_services(&state.db, &body.affected_services).await?;
    let message = clean_optional(body.message).unwrap_or_else(|| DEFAULT_SCHEDULED_MESSAGE.to_string());

    let mut tx = state.db.begin().await?;
    let (id,): (i64,) = sqlx::query_as(
        r#"
        INSERT INTO maintenance (title, description, status, affected_services, scheduled_start, scheduled_end)
        VALUES ($1, $2, 'scheduled', $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(&title)
    .bind(clean_optional(body.description))
    .bind(&body.affected_services)
    .bind(body.scheduled_start)
    .bind(body.scheduled_end)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("INSERT INTO maintenance_updates (maintenance_id, status, message) VALUES ($1, 'scheduled', $2)")
        .bind(id)
        .bind(&message)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let details = activity::created(snapshot(&state, "maintenance", id).await);
    log(&state, &user, "scheduled maintenance", Some(id), &title, details).await;
    notifications::notify(
        &state.db,
        Event::MaintenanceScheduled {
            id,
            title: title.clone(),
            start: body.scheduled_start,
            end: body.scheduled_end,
            services: body.affected_services.clone(),
        },
    );
    Ok((StatusCode::CREATED, Json(Created { id })))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<MaintenanceBody>,
) -> Result<StatusCode, ApiError> {
    user.require("maintenance.edit")?;
    find_title(&state.db, id).await?;
    let before = snapshot(&state, "maintenance", id).await;
    let title = clean_title(&body.title)?;
    check_window(body.scheduled_start, body.scheduled_end)?;
    check_services(&state.db, &body.affected_services).await?;

    sqlx::query(
        r#"
        UPDATE maintenance
        SET title = $1, description = $2, affected_services = $3, scheduled_start = $4, scheduled_end = $5,
            start_notified = start_notified AND $4 <= now(),
            end_notified = end_notified AND $5 <= now()
        WHERE id = $6
        "#,
    )
    .bind(&title)
    .bind(clean_optional(body.description))
    .bind(&body.affected_services)
    .bind(body.scheduled_start)
    .bind(body.scheduled_end)
    .bind(id)
    .execute(&state.db)
    .await?;

    let details = activity::changes(before, snapshot(&state, "maintenance", id).await);
    log(&state, &user, "edited maintenance", Some(id), &title, details).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn cancel(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<CancelBody>,
) -> Result<StatusCode, ApiError> {
    user.require("maintenance.cancel")?;
    let title = find_title(&state.db, id).await?;
    let message = clean_optional(body.message).unwrap_or_else(|| DEFAULT_CANCELLED_MESSAGE.to_string());
    let before = snapshot(&state, "maintenance", id).await;

    let mut tx = state.db.begin().await?;
    sqlx::query("UPDATE maintenance SET status = 'cancelled' WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO maintenance_updates (maintenance_id, status, message) VALUES ($1, 'cancelled', $2)")
        .bind(id)
        .bind(&message)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let mut details = activity::changes(before, snapshot(&state, "maintenance", id).await).unwrap_or_else(|| json!({}));
    details["message"] = json!(message);
    log(&state, &user, "cancelled maintenance", Some(id), &title, Some(details)).await;
    let services: Option<(Option<Vec<String>>,)> = sqlx::query_as("SELECT affected_services FROM maintenance WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?;
    notifications::notify(
        &state.db,
        Event::MaintenanceCancelled {
            id,
            title: title.clone(),
            message: message.clone(),
            services: services.and_then(|(list,)| list).unwrap_or_default(),
        },
    );
    Ok(StatusCode::NO_CONTENT)
}

/// Undoes a cancel. The visible status follows the schedule again, and a
/// timeline update says so.
pub async fn reactivate(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("maintenance.cancel")?;
    let title = find_title(&state.db, id).await?;
    let before = snapshot(&state, "maintenance", id).await;

    let mut tx = state.db.begin().await?;
    sqlx::query("UPDATE maintenance SET status = 'scheduled' WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        r#"
        INSERT INTO maintenance_updates (maintenance_id, status, message)
        SELECT id,
            CASE
                WHEN now() < scheduled_start THEN 'scheduled'
                WHEN now() < scheduled_end THEN 'in_progress'
                ELSE 'completed'
            END,
            $2
        FROM maintenance WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(DEFAULT_REACTIVATED_MESSAGE)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let details = activity::changes(before, snapshot(&state, "maintenance", id).await);
    log(&state, &user, "reactivated maintenance", Some(id), &title, details).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("maintenance.delete")?;
    let title = find_title(&state.db, id).await?;
    let before = snapshot(&state, "maintenance", id).await;
    sqlx::query("DELETE FROM maintenance WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    log(&state, &user, "deleted maintenance", None, &title, activity::deleted(before)).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<UpdateBody>,
) -> Result<(StatusCode, Json<StatusUpdate>), ApiError> {
    user.require("maintenance.update")?;
    let title = find_title(&state.db, id).await?;
    check_status(&body.status)?;
    let message = clean_message(&body.message)?;

    let created: StatusUpdate = sqlx::query_as(
        r#"
        INSERT INTO maintenance_updates (maintenance_id, status, message)
        VALUES ($1, $2, $3)
        RETURNING id, status, message, created_at
        "#,
    )
    .bind(id)
    .bind(&body.status)
    .bind(&message)
    .fetch_one(&state.db)
    .await?;

    let details = Some(json!({ "update": created }));
    log(&state, &user, "posted an update on maintenance", Some(id), &title, details).await;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn edit_update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, update_id)): Path<(i64, i64)>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<StatusUpdate>, ApiError> {
    user.require("maintenance.edit")?;
    check_status(&body.status)?;
    let message = clean_message(&body.message)?;
    let before = snapshot(&state, "maintenance_updates", update_id).await;

    let edited: Option<StatusUpdate> = sqlx::query_as(
        r#"
        UPDATE maintenance_updates SET status = $1, message = $2
        WHERE id = $3 AND maintenance_id = $4
        RETURNING id, status, message, created_at
        "#,
    )
    .bind(&body.status)
    .bind(&message)
    .bind(update_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let edited = edited.ok_or(ApiError::NotFound)?;
    let title = find_title(&state.db, id).await?;
    let details = activity::changes(before, snapshot(&state, "maintenance_updates", update_id).await);
    log(&state, &user, "edited an update on maintenance", Some(id), &title, details).await;
    Ok(Json(edited))
}

pub async fn delete_update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, update_id)): Path<(i64, i64)>,
) -> Result<StatusCode, ApiError> {
    user.require("maintenance.edit")?;
    let before = snapshot(&state, "maintenance_updates", update_id).await;
    let deleted = sqlx::query("DELETE FROM maintenance_updates WHERE id = $1 AND maintenance_id = $2")
        .bind(update_id)
        .bind(id)
        .execute(&state.db)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(ApiError::NotFound);
    }
    let title = find_title(&state.db, id).await?;
    log(&state, &user, "deleted an update on maintenance", Some(id), &title, activity::deleted(before)).await;
    Ok(StatusCode::NO_CONTENT)
}
