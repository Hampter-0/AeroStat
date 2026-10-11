use axum::{extract::State, Json};

use crate::services::{check_service, CheckableService};
use crate::state::AppState;
use crate::{db, models};

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

pub async fn check_now(State(state): State<AppState>) -> Json<Vec<models::CheckResult>> {
    let services: Vec<CheckableService> = sqlx::query_as(
        "SELECT id, url, expected_status, check_interval_seconds FROM services ORDER BY sort_order",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let client = reqwest::Client::new();
    let mut results = Vec::new();

    for service in &services {
        let result = check_service(&client, service).await;

        if let Err(e) = db::record(&state.db, &result).await {
            tracing::error!("Failed to record metric for {}: {e}", result.service_id);
        }

        results.push(result);
    }

    Json(results)
}