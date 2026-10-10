mod cli;
mod config;
mod db;
mod models;
mod state;
mod services;

use crate::services::{check_service, CheckableService};
use axum::{extract::State, routing::get, Json, Router};
use clap::Parser;
use cli::Commands;
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

    let cli = cli::Cli::parse();
    let settings = config::Settings::load()?;
    let pool = db::connect(&settings.database_url).await?;

    match cli.command {
        Some(Commands::Migrate) => {
            db::migrate(&pool).await?;
            tracing::info!("Migrations applied, exiting");
            return Ok(());
        }
        Some(Commands::Seed) => {
            db::migrate(&pool).await?;
            db::seed_from_file(&pool, "config/services.yml").await?;
            tracing::info!("Seed complete, exiting");
            return Ok(());
        }
        None => {}
    }

    db::migrate(&pool).await?;
    tracing::info!("Connected to Postgres and ran migrations");

    if settings.seed_on_startup {
        db::seed_from_file(&pool, "config/services.yml").await?;
    } else {
        tracing::info!("SEED_ON_STARTUP=false, skipping automatic seeding");
    }

    let state = AppState { db: pool };

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/api/services", get(list_services))
        .route("/api/check-now", get(check_now))
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

async fn check_now(State(state): State<AppState>) -> Json<Vec<crate::models::CheckResult>> {
    let services: Vec<CheckableService> = sqlx::query_as(
        "SELECT id, url, expected_status FROM services ORDER BY sort_order",
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