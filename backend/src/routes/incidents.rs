use axum::{extract::Path, extract::Query, extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::models::{Incident, StatusUpdate};
use crate::state::AppState;

#[derive(Serialize)]
pub struct IncidentDetail {
    #[serde(flatten)]
    incident: Incident,
    updates: Vec<StatusUpdate>,
}

const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 500;

/// Optional range for the history pages: incidents created at or after
/// `from` and before `to`, newest first.
#[derive(Deserialize)]
pub struct ListQuery {
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
    limit: Option<i64>,
}

pub async fn list(State(state): State<AppState>, Query(query): Query<ListQuery>) -> Json<Vec<Incident>> {
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let rows: Vec<Incident> = sqlx::query_as(
        r#"
        SELECT * FROM incidents
        WHERE ($1::timestamptz IS NULL OR created_at >= $1)
          AND ($2::timestamptz IS NULL OR created_at < $2)
        ORDER BY created_at DESC
        LIMIT $3
        "#,
    )
    .bind(query.from)
    .bind(query.to)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<IncidentDetail>, StatusCode> {
    let incident: Incident = sqlx::query_as("SELECT * FROM incidents WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let updates: Vec<StatusUpdate> = sqlx::query_as(
        "SELECT id, status, message, created_at FROM incident_updates WHERE incident_id = $1 ORDER BY created_at DESC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(IncidentDetail { incident, updates }))
}
