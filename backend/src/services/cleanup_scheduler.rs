use std::time::Duration;

use sqlx::PgPool;

/// Runs metrics cleanup once a day
pub fn spawn(pool: PgPool, retention_days: i32) {
    tokio::spawn(async move {
        let interval = Duration::from_secs(24 * 60 * 60);

        loop {
            match crate::db::cleanup_old_metrics(&pool, retention_days).await {
                Ok(deleted) if deleted > 0 => {
                    tracing::info!("Cleanup: removed {deleted} metric(s) older than {retention_days} days");
                }
                Ok(_) => {}
                Err(e) => tracing::error!("Metrics cleanup failed: {e}"),
            }

            tokio::time::sleep(interval).await;
        }
    });
}