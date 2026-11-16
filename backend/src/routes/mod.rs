mod cards;
mod incidents;
pub mod manage;
mod maintenance;
pub mod settings;
mod status;
mod uptime;

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
        .route("/api/status", get(status::get))
        .route("/api/cards/:id", get(cards::get))
        .route("/api/incidents", get(incidents::list))
        .route("/api/incidents/:id", get(incidents::get))
        .route("/api/maintenance", get(maintenance::list))
        .route("/api/maintenance/:id", get(maintenance::get))
        .route("/api/uptime/:service_id", get(uptime::get))
        .route("/api/settings", get(settings::get))
        .route("/api/brand/:name", get(settings::brand_asset))
        .nest("/api/manage", manage::router())
        .with_state(state)
}