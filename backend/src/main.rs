mod cli;
mod config;
mod db;
mod models;
mod routes;
mod services;
mod state;

use clap::Parser;
use cli::Commands;
use state::AppState;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    cli::print_banner();
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let cli = cli::Cli::parse();
    let settings = config::Settings::load()?;
    let pool = db::connect(&settings.database_url).await?;
    let redis_pool = db::connect_redis(&settings.redis_url)?;
    tracing::info!("Connected to Redis");

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

    services::spawn_all(pool.clone()).await?;
    tracing::info!("Service checkers started");

    services::spawn_cleanup(pool.clone(), settings.metrics_retention_days);
    tracing::info!(
        "Metrics cleanup scheduled (retention: {} days)",
        settings.metrics_retention_days
    );

    services::spawn_rollup(pool.clone(), redis_pool.clone());
    tracing::info!("Daily rollup scheduled");

    let state = AppState {
        db: pool,
        redis: redis_pool,
    };

    let app = routes::build(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{}", settings.port);
    tracing::info!("Statuspage backend listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
