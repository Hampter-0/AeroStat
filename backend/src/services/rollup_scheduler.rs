use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use chrono_tz::Tz;
use deadpool_redis::Pool as RedisPool;
use sqlx::PgPool;

use crate::site_settings;

pub fn spawn(db: PgPool, redis: RedisPool) {
    tokio::spawn(async move {
        if let Err(e) = crate::db::backfill(&db, &redis).await {
            tracing::error!("Rollup backfill failed: {e}");
        }

        loop {
            let tz = site_settings::timezone(&db).await;
            tokio::time::sleep(until_next_rollup(tz)).await;

            if let Err(e) = crate::db::rollup_yesterday(&db, &redis).await {
                tracing::error!("Rollup failed: {e}");
            }
        }
    });
}

/// 00:05 in the site's timezone instead of midnight so the last checks of the day are in.
fn until_next_rollup(tz: Tz) -> Duration {
    let tomorrow = site_settings::today(tz) + ChronoDuration::days(1);
    let next = site_settings::start_of_day(tomorrow, tz) + ChronoDuration::minutes(5);
    (next - Utc::now()).to_std().unwrap_or(Duration::from_secs(60))
}
