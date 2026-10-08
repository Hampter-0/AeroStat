mod config;
mod db;
mod state;

use axum::{extract::State, routing::get, Json, Router};
use state::AppState;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let settings = config::Settings::load()?;

    let pool = db::init(&settings.database_url).await?;
    tracing::info!("Connected to Postgres and ran migrations");

    let state = AppState { db: pool };

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/api/services", get(list_services))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{}", settings.port);
    tracing::info!("Statuspage backend listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn root() -> &'static str {
    "Statuspage API is running"
}

async fn health() -> &'static str {
    "ok"
}

#[derive(serde::Serialize)]
struct ServiceRow {
    id: String,
    name: String,
    url: String,
}

async fn list_services(State(state): State<AppState>) -> Json<Vec<ServiceRow>> {
    let rows = sqlx::query_as!(
        ServiceRow,
        "SELECT id, name, url FROM services ORDER BY sort_order"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}
