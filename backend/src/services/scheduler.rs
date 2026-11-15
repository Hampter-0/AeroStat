use std::time::Duration;

use sqlx::PgPool;

use crate::db;
use crate::services::checker::{check_service, CheckableService};

const TICK: Duration = Duration::from_secs(5);

/// One loop for all services: every tick it claims the services whose
/// `next_check_at` has passed and checks them. Services added, edited or
/// deleted in the panel are picked up on the next tick, no restart needed.
pub fn spawn_all(pool: PgPool) {
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        loop {
            match claim_due(&pool).await {
                Ok(services) => {
                    for service in services {
                        tokio::spawn(run_check(pool.clone(), client.clone(), service));
                    }
                }
                Err(e) => tracing::error!("Could not load services to check: {e}"),
            }
            tokio::time::sleep(TICK).await;
        }
    });
}

/// Moves `next_check_at` forward in the same statement that selects the
/// services, so a slow check is never started twice.
async fn claim_due(pool: &PgPool) -> anyhow::Result<Vec<CheckableService>> {
    let services = sqlx::query_as(
        r#"
        UPDATE services
        SET next_check_at = now() + make_interval(secs => GREATEST(check_interval_seconds, 1))
        WHERE next_check_at <= now()
        RETURNING id, url, expected_status
        "#,
    )
    .fetch_all(pool)
    .await?;
    Ok(services)
}

async fn run_check(pool: PgPool, client: reqwest::Client, service: CheckableService) {
    let result = check_service(&client, &service).await;

    if let Err(e) = db::record(&pool, &result).await {
        tracing::warn!("Could not record check for {} (deleted meanwhile?): {e}", result.service_id);
        return;
    }

    tracing::info!(
        "Checked {} -> {} ({}ms)",
        service.id,
        result.status,
        result.response_time_ms
    );
}
