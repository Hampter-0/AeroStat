use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::activity;
use crate::auth::CurrentUser;
use crate::notifications::{self, Event};
use crate::error::ApiError;
use crate::models::{Incident, StatusUpdate};
use crate::state::AppState;

const PERMISSION: &str = "incidents";
const STATUSES: [&str; 4] = ["investigating", "identified", "monitoring", "resolved"];
const SEVERITIES: [&str; 3] = ["minor", "major", "critical"];

#[derive(Deserialize)]
pub struct CreateIncident {
    title: String,
    description: Option<String>,
    severity: String,
    affected_services: Vec<String>,
    status: String,
    message: String,
    /// When it started, for an incident that is posted late. Defaults to now.
    started_at: Option<DateTime<Utc>>,
    /// Only with status "resolved": when it was fixed. Defaults to now.
    resolved_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct UpdateIncident {
    title: String,
    description: Option<String>,
    severity: String,
    affected_services: Vec<String>,
    started_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct UpdateBody {
    status: String,
    message: String,
    /// Moves an update to another time, like Statuspage's display time.
    created_at: Option<DateTime<Utc>>,
}

/// A minute of slack so a browser clock that runs a little ahead still works.
fn check_not_future(time: DateTime<Utc>, what: &str) -> Result<(), ApiError> {
    if time > Utc::now() + Duration::minutes(1) {
        return Err(ApiError::BadRequest(format!("{what} can't be in the future")));
    }
    Ok(())
}

async fn first_update_at(db: &PgPool, id: i64) -> Result<Option<DateTime<Utc>>, ApiError> {
    let first: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT MIN(created_at) FROM incident_updates WHERE incident_id = $1")
            .bind(id)
            .fetch_one(db)
            .await?;
    Ok(first)
}

fn clean_title(title: &str) -> Result<String, ApiError> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(ApiError::BadRequest("Title must be 1-200 characters".into()));
    }
    Ok(title.to_string())
}

fn clean_message(message: &str) -> Result<String, ApiError> {
    let message = message.trim();
    if message.is_empty() {
        return Err(ApiError::BadRequest("Message can't be empty".into()));
    }
    Ok(message.to_string())
}

fn clean_description(description: Option<String>) -> Option<String> {
    description
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn check_status(status: &str) -> Result<(), ApiError> {
    if STATUSES.contains(&status) {
        return Ok(());
    }
    Err(ApiError::BadRequest(format!("Unknown status: {status}")))
}

fn check_severity(severity: &str) -> Result<(), ApiError> {
    if SEVERITIES.contains(&severity) {
        return Ok(());
    }
    Err(ApiError::BadRequest(format!("Unknown severity: {severity}")))
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

async fn log(state: &AppState, user: &CurrentUser, action: &str, id: Option<i64>, title: &str, details: Option<Value>) {
    activity::record(&state.db, user, PERMISSION, action, id.map(|id| id.to_string()), title, details).await;
}

async fn snapshot(state: &AppState, table: &str, id: i64) -> Option<Value> {
    activity::snapshot(&state.db, table, &id.to_string()).await
}

async fn find_incident(db: &PgPool, id: i64) -> Result<Incident, ApiError> {
    let incident: Option<Incident> = sqlx::query_as("SELECT * FROM incidents WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await?;
    incident.ok_or(ApiError::NotFound)
}

/// The incident's status always mirrors its newest update; resolved_at is the
/// time of that update when it is "resolved".
async fn sync_status(db: &PgPool, id: i64) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        UPDATE incidents i
        SET status = latest.status,
            resolved_at = CASE WHEN latest.status = 'resolved' THEN latest.created_at ELSE NULL END
        FROM (
            SELECT status, created_at FROM incident_updates
            WHERE incident_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) latest
        WHERE i.id = $1
        "#,
    )
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<CreateIncident>,
) -> Result<(StatusCode, Json<Incident>), ApiError> {
    user.require("incidents.create")?;
    let title = clean_title(&body.title)?;
    let message = clean_message(&body.message)?;
    check_status(&body.status)?;
    check_severity(&body.severity)?;
    check_services(&state.db, &body.affected_services).await?;

    let now = Utc::now();
    let started_at = body.started_at.unwrap_or(now);
    check_not_future(started_at, "The start time")?;
    // A resolved incident is a backfill of something that already happened.
    // Its one update is posted at the time it was fixed, so the incident runs
    // from started_at to resolved_at. Like Statuspage, nobody is notified.
    let backfill = body.status == "resolved";
    let mut update_at = started_at;
    if backfill {
        let resolved_at = body.resolved_at.unwrap_or(now);
        check_not_future(resolved_at, "The resolve time")?;
        if resolved_at < started_at {
            return Err(ApiError::BadRequest("It can't be resolved before it started".into()));
        }
        update_at = resolved_at;
    }

    let mut tx = state.db.begin().await?;
    let (id,): (i64,) = sqlx::query_as(
        r#"
        INSERT INTO incidents (title, description, status, severity, affected_services, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(&title)
    .bind(clean_description(body.description))
    .bind(&body.status)
    .bind(&body.severity)
    .bind(&body.affected_services)
    .bind(started_at)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("INSERT INTO incident_updates (incident_id, status, message, created_at) VALUES ($1, $2, $3, $4)")
        .bind(id)
        .bind(&body.status)
        .bind(&message)
        .bind(update_at)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    sync_status(&state.db, id).await?;
    let details = activity::created(snapshot(&state, "incidents", id).await);
    let mut action = "created incident";
    if backfill {
        action = "added a past incident";
    }
    log(&state, &user, action, Some(id), &title, details).await;
    if backfill {
        return Ok((StatusCode::CREATED, Json(find_incident(&state.db, id).await?)));
    }
    notifications::notify_by(
        &state.db,
        Event::IncidentCreated {
            id,
            title: title.clone(),
            status: body.status.clone(),
            severity: body.severity.clone(),
            message: message.clone(),
            services: body.affected_services.clone(),
        },
        Some(user.id),
    );
    Ok((StatusCode::CREATED, Json(find_incident(&state.db, id).await?)))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<UpdateIncident>,
) -> Result<Json<Incident>, ApiError> {
    user.require("incidents.edit")?;
    let incident = find_incident(&state.db, id).await?;
    let before = snapshot(&state, "incidents", id).await;
    let title = clean_title(&body.title)?;
    check_severity(&body.severity)?;
    check_services(&state.db, &body.affected_services).await?;

    let started_at = body.started_at.unwrap_or(incident.created_at);
    if started_at != incident.created_at {
        check_not_future(started_at, "The start time")?;
        if let Some(first) = first_update_at(&state.db, id).await? {
            if started_at > first {
                return Err(ApiError::BadRequest(
                    "It can't start after its first update. Move that update first".into(),
                ));
            }
        }
    }

    sqlx::query(
        r#"
        UPDATE incidents SET title = $1, description = $2, severity = $3, affected_services = $4, created_at = $5
        WHERE id = $6
        "#,
    )
    .bind(&title)
    .bind(clean_description(body.description))
    .bind(&body.severity)
    .bind(&body.affected_services)
    .bind(started_at)
    .bind(id)
    .execute(&state.db)
    .await?;

    let details = activity::changes(before, snapshot(&state, "incidents", id).await);
    log(&state, &user, "edited incident", Some(id), &title, details).await;
    Ok(Json(find_incident(&state.db, id).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("incidents.delete")?;
    let incident = find_incident(&state.db, id).await?;
    let before = snapshot(&state, "incidents", id).await;
    sqlx::query("DELETE FROM incidents WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    log(&state, &user, "deleted incident", None, &incident.title, activity::deleted(before)).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<UpdateBody>,
) -> Result<(StatusCode, Json<StatusUpdate>), ApiError> {
    user.require("incidents.update")?;
    let incident = find_incident(&state.db, id).await?;
    check_status(&body.status)?;
    let message = clean_message(&body.message)?;

    let created: StatusUpdate = sqlx::query_as(
        r#"
        INSERT INTO incident_updates (incident_id, status, message)
        VALUES ($1, $2, $3)
        RETURNING id, status, message, created_at
        "#,
    )
    .bind(id)
    .bind(&body.status)
    .bind(&message)
    .fetch_one(&state.db)
    .await?;

    sync_status(&state.db, id).await?;
    let action = if body.status == "resolved" {
        "resolved incident"
    } else {
        "posted an update on incident"
    };
    let details = Some(json!({ "update": created }));
    log(&state, &user, action, Some(id), &incident.title, details).await;
    notifications::notify_by(
        &state.db,
        Event::IncidentUpdated {
            id,
            title: incident.title.clone(),
            status: body.status.clone(),
            message: message.clone(),
            services: incident.affected_services.clone().unwrap_or_default(),
        },
        Some(user.id),
    );
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn edit_update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, update_id)): Path<(i64, i64)>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<StatusUpdate>, ApiError> {
    user.require("incidents.edit")?;
    check_status(&body.status)?;
    let message = clean_message(&body.message)?;
    let incident = find_incident(&state.db, id).await?;
    if let Some(time) = body.created_at {
        check_not_future(time, "An update")?;
        if time < incident.created_at {
            return Err(ApiError::BadRequest(
                "An update can't be before the incident started. Change the start time first".into(),
            ));
        }
    }
    let before = snapshot(&state, "incident_updates", update_id).await;

    let edited: Option<StatusUpdate> = sqlx::query_as(
        r#"
        UPDATE incident_updates SET status = $1, message = $2, created_at = COALESCE($3, created_at)
        WHERE id = $4 AND incident_id = $5
        RETURNING id, status, message, created_at
        "#,
    )
    .bind(&body.status)
    .bind(&message)
    .bind(body.created_at)
    .bind(update_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await?;
    let edited = edited.ok_or(ApiError::NotFound)?;

    sync_status(&state.db, id).await?;
    let incident = find_incident(&state.db, id).await?;
    let details = activity::changes(before, snapshot(&state, "incident_updates", update_id).await);
    log(&state, &user, "edited an update on incident", Some(id), &incident.title, details).await;
    Ok(Json(edited))
}

pub async fn delete_update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, update_id)): Path<(i64, i64)>,
) -> Result<StatusCode, ApiError> {
    user.require("incidents.edit")?;

    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM incident_updates WHERE incident_id = $1")
        .bind(id)
        .fetch_one(&state.db)
        .await?;
    if count <= 1 {
        return Err(ApiError::BadRequest(
            "An incident needs at least one update. Delete the incident instead".into(),
        ));
    }

    let before = snapshot(&state, "incident_updates", update_id).await;
    let deleted = sqlx::query("DELETE FROM incident_updates WHERE id = $1 AND incident_id = $2")
        .bind(update_id)
        .bind(id)
        .execute(&state.db)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(ApiError::NotFound);
    }

    sync_status(&state.db, id).await?;
    let incident = find_incident(&state.db, id).await?;
    log(&state, &user, "deleted an update on incident", Some(id), &incident.title, activity::deleted(before)).await;
    Ok(StatusCode::NO_CONTENT)
}
