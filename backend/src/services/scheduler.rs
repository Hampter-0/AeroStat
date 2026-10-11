use std::time::Duration;

use sqlx::PgPool;

use crate::db;
use crate::services::checker::{check_service, CheckableService};

/// Reads all services once at startup and spawns one independent background task per service.
pub async fn spawn_all(pool: PgPool) -> anyhow::Result<()> {
    let services: Vec<CheckableService> = sqlx::query_as(
        "SELECT id, url, expected_status, check_interval_seconds FROM services",
    )
    .fetch_all(&pool)
    .await?;

    for service in services {
        let pool = pool.clone();
        tokio::spawn(run_service_loop(pool, service));
    }

    Ok(())
}

async fn run_service_loop(pool: PgPool, service: CheckableService) {
    let client = reqwest::Client::new();
    let interval = Duration::from_secs(service.check_interval_seconds.max(1) as u64);

    loop {
        let result = check_service(&client, &service).await;

        if let Err(e) = db::record(&pool, &result).await {
            tracing::error!("Failed to record metric for {}: {e}", result.service_id);
        }

        tracing::info!(
            "Checked {} -> {} ({}ms)",
            service.id,
            result.status,
            result.response_time_ms
        );

        tokio::time::sleep(interval).await;
    }
}