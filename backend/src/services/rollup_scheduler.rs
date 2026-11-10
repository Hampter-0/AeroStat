use std::time::Duration;

use deadpool_redis::Pool as RedisPool;
use sqlx::PgPool;

pub fn spawn(db: PgPool, redis: RedisPool) {
    tokio::spawn(async move {
        let interval = Duration::from_secs(24 * 60 * 60);

        loop {
            if let Err(e) = crate::db::rollup_yesterday(&db, &redis).await {
                tracing::error!("Rollup failed: {e}");
            }

            tokio::time::sleep(interval).await;
        }
    });
}