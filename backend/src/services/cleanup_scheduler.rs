use std::time::Duration;

use sqlx::PgPool;

use crate::site_settings;

/// Runs metrics cleanup once a day. The retention comes from the panel
/// settings, with the METRICS_RETENTION_DAYS env value as fallback.
pub fn spawn(pool: PgPool, default_retention_days: i32) {
    tokio::spawn(async move {
        let interval = Duration::from_secs(24 * 60 * 60);

        loop {
            let retention_days = site_settings::retention_days(&pool, default_retention_days).await;
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
