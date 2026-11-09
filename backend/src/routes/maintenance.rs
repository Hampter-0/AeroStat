use axum::{extract::State, Json};

use crate::models::Maintenance;
use crate::state::AppState;

pub async fn list(State(state): State<AppState>) -> Json<Vec<Maintenance>> {
    let rows: Vec<Maintenance> = sqlx::query_as(
        "SELECT * FROM maintenance ORDER BY scheduled_start DESC",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}