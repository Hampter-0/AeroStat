use axum::{extract::Path, extract::State, http::StatusCode, Json};
use serde::Serialize;

use crate::models::{Incident, StatusUpdate};
use crate::state::AppState;

#[derive(Serialize)]
pub struct IncidentDetail {
    #[serde(flatten)]
    incident: Incident,
    updates: Vec<StatusUpdate>,
}

pub async fn list(State(state): State<AppState>) -> Json<Vec<Incident>> {
    let rows: Vec<Incident> = sqlx::query_as(
        "SELECT * FROM incidents ORDER BY created_at DESC LIMIT 50",
    )
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
