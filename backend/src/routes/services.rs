use axum::{extract::State, Json};

use crate::state::AppState;

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct ServiceRow {
    id: String,
    name: String,
    url: String,
}

pub async fn list(State(state): State<AppState>) -> Json<Vec<ServiceRow>> {
    let rows: Vec<ServiceRow> = sqlx::query_as("SELECT id, name, url FROM services ORDER BY sort_order")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    Json(rows)
}
