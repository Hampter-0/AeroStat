use std::time::Duration;

use sqlx::PgPool;

use crate::site_settings;

const ACTIVITY_RETENTION_DAYS: i32 = 365;
/// Pictures in old notifications; long after anyone looks at them.
const CARD_RETENTION_DAYS: i32 = 365;

/// Runs metrics cleanup once a day. The retention comes from the panel
/// settings, with the METRICS_RETENTION_DAYS env value as fallback. The
/// activity log is kept for a year.
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
            let details = sqlx::query("UPDATE metrics SET details = NULL WHERE details IS NOT NULL AND checked_at < now() - interval '7 days'")
                .execute(&pool)
                .await;
            if let Err(e) = details {
                tracing::error!("Clearing old check details failed: {e}");
            }
            if let Err(e) = crate::activity::cleanup(&pool, ACTIVITY_RETENTION_DAYS).await {
                tracing::error!("Activity log cleanup failed: {e}");
            }
            let cards = sqlx::query("DELETE FROM share_cards WHERE created_at < now() - make_interval(days => $1)")
                .bind(CARD_RETENTION_DAYS)
                .execute(&pool)
                .await;
            if let Err(e) = cards {
                tracing::error!("Notification picture cleanup failed: {e}");
            }

            tokio::time::sleep(interval).await;
        }
    });
}
