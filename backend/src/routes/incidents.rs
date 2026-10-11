use axum::{extract::State, Json};

use crate::models::Incident;
use crate::state::AppState;

pub async fn list(State(state): State<AppState>) -> Json<Vec<Incident>> {
    let rows: Vec<Incident> = sqlx::query_as(
        "SELECT * FROM incidents ORDER BY created_at DESC LIMIT 50",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}