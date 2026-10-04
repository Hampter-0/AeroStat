use axum::{routing::get, Router};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/", get(|| async { "Statuspage API is running" }))
        .route("/health", get(|| async { "ok" }));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3004").await?;
    tracing::info!("Listening on :3004");
    axum::serve(listener, app).await?;
    Ok(())
}
