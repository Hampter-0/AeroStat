mod activity;
mod auth;
mod cli;
mod config;
mod console;
mod db;
mod error;
mod login_guard;
mod models;
mod routes;
mod services;
mod site_settings;
mod state;

use clap::Parser;
use cli::Commands;
use state::AppState;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    cli::print_banner();
    dotenvy::dotenv().ok();

    let cli = cli::Cli::parse();

    // The interactive CLI ignores RUST_LOG so info logs don't clutter the menu.
    let filter = if matches!(cli.command, Some(Commands::Cli)) {
        EnvFilter::new("warn")
    } else {
        EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into())
    };
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let settings = config::Settings::load()?;
    let pool = db::connect(&settings.database_url).await?;
    let redis_pool = db::connect_redis(&settings.redis_url)?;
    tracing::info!("Connected to Redis");

    match cli.command {
        Some(Commands::Cli) => {
            console::run(&pool, &redis_pool).await?;
            return Ok(());
        }
        Some(Commands::Migrate) => {
            db::migrate(&pool).await?;
            tracing::info!("Migrations applied, exiting");
            return Ok(());
        }
        Some(Commands::CreateAdmin { username }) => {
            db::migrate(&pool).await?;
            let password = match std::env::var("ADMIN_PASSWORD") {
                Ok(password) => password,
                Err(_) => {
                    let password = rpassword::prompt_password("Password: ")?;
                    let confirm = rpassword::prompt_password("Repeat password: ")?;
                    if password != confirm {
                        anyhow::bail!("Passwords do not match");
                    }
                    password
                }
            };
            routes::manage::create_admin_from_cli(&pool, &username, password).await?;
            println!("Admin '{}' is ready. Sign in at /manage.", username.trim().to_lowercase());
            return Ok(());
        }
        None => {}
    }

    db::migrate(&pool).await?;
    tracing::info!("Connected to Postgres and ran migrations");

    services::spawn_all(pool.clone());
    tracing::info!("Service checker started");

    services::spawn_cleanup(pool.clone(), settings.metrics_retention_days);
    tracing::info!("Metrics cleanup scheduled");

    services::spawn_rollup(pool.clone(), redis_pool.clone());
    tracing::info!("Daily rollup scheduled");

    let state = AppState {
        db: pool,
        redis: redis_pool,
        default_retention_days: settings.metrics_retention_days,
        login_limits: settings.login_limits,
        session_days: settings.session_days,
    };

    // No CORS layer: browsers never call the backend directly, only the
    // Next.js server does.
    let app = routes::build(state).layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind((settings.host.as_str(), settings.port)).await?;
    tracing::info!("Statuspage backend listening on {}", listener.local_addr()?);

    axum::serve(listener, app).await?;

    Ok(())
}
