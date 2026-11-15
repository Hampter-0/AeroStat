use axum::{extract::State, Json};

use crate::state::AppState;

#[derive(serde::Serialize)]
pub struct ServiceRow {
    id: String,
    name: String,
    url: String,
}

pub async fn list(State(state): State<AppState>) -> Json<Vec<ServiceRow>> {
    let rows = sqlx::query_as!(
        ServiceRow,
        "SELECT id, name, url FROM services ORDER BY sort_order"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}
