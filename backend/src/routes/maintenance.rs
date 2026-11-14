use axum::{extract::Path, extract::State, http::StatusCode, Json};
use serde::Serialize;

use crate::models::{Maintenance, StatusUpdate};
use crate::state::AppState;

/// Status follows the schedule; only "cancelled" is set by hand.
const SELECT_MAINTENANCE: &str = r#"
    SELECT
        id,
        title,
        description,
        CASE
            WHEN status = 'cancelled' THEN 'cancelled'
            WHEN now() < scheduled_start THEN 'scheduled'
            WHEN now() < scheduled_end THEN 'in_progress'
            ELSE 'completed'
        END AS status,
        affected_services,
        scheduled_start,
        scheduled_end,
        created_at
    FROM maintenance
"#;

#[derive(Serialize)]
pub struct MaintenanceDetail {
    #[serde(flatten)]
    maintenance: Maintenance,
    updates: Vec<StatusUpdate>,
}

pub async fn list(State(state): State<AppState>) -> Json<Vec<Maintenance>> {
    let query = format!("{SELECT_MAINTENANCE} ORDER BY scheduled_start DESC");
    let rows: Vec<Maintenance> = sqlx::query_as(&query)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    Json(rows)
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<MaintenanceDetail>, StatusCode> {
    let query = format!("{SELECT_MAINTENANCE} WHERE id = $1");
    let maintenance: Maintenance = sqlx::query_as(&query)
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let updates: Vec<StatusUpdate> = sqlx::query_as(
        "SELECT id, status, message, created_at FROM maintenance_updates WHERE maintenance_id = $1 ORDER BY created_at DESC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(MaintenanceDetail { maintenance, updates }))
}
