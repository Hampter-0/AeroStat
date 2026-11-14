use std::time::Duration;

use chrono::Utc;
use deadpool_redis::Pool as RedisPool;
use sqlx::PgPool;

pub fn spawn(db: PgPool, redis: RedisPool) {
    tokio::spawn(async move {
        if let Err(e) = crate::db::backfill(&db, &redis).await {
            tracing::error!("Rollup backfill failed: {e}");
        }

        loop {
            tokio::time::sleep(until_next_rollup()).await;

            if let Err(e) = crate::db::rollup_yesterday(&db, &redis).await {
                tracing::error!("Rollup failed: {e}");
            }
        }
    });
}

/// 00:05 UTC instead of midnight so the last checks of the day are in.
fn until_next_rollup() -> Duration {
    let now = Utc::now();
    let next = (now.date_naive() + chrono::Duration::days(1))
        .and_hms_opt(0, 5, 0)
        .unwrap()
        .and_utc();
    (next - now).to_std().unwrap_or(Duration::from_secs(60))
}
