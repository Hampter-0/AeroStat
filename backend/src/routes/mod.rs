mod incidents;
mod maintenance;
mod services;
mod status;

use axum::{routing::get, Router};

use crate::state::AppState;

pub async fn root() -> &'static str {
    "Statuspage API is running"
}

pub async fn health() -> &'static str {
    "ok"
}

pub fn build(state: AppState) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/api/services", get(services::list))
        .route("/api/check-now", get(services::check_now))
        .route("/api/status", get(status::get))
        .route("/api/incidents", get(incidents::list))
        .route("/api/maintenance", get(maintenance::list))
        .with_state(state)
}