use deadpool_redis::{Config, Pool, Runtime};
use deadpool_redis::redis::AsyncCommands;

const DAILY_STATUS_TTL_SECONDS: u64 = 62 * 24 * 60 * 60;

/// Creates a Redis connection pool from a connection URL like
/// "redis://localhost:6379".
pub fn connect(redis_url: &str) -> anyhow::Result<Pool> {
    let config = Config::from_url(redis_url);
    let pool = config.create_pool(Some(Runtime::Tokio1))?;
    Ok(pool)
}

fn daily_status_key(service_id: &str, date: &str) -> String {
    format!("uptime:{service_id}:{date}")
}

/// Stores one day's rollup status for a service. Key format:
/// uptime:<service_id>:<date>  →  "<status>:<downtime_minutes>:<avg_response_ms>",
/// where status is "online" | "degraded" | "offline" and the average is empty
/// when no check was up. Values from before 0.27.3 have no average.
pub async fn set_daily_status(
    pool: &Pool,
    service_id: &str,
    date: &str,
    status: &str,
) -> anyhow::Result<()> {
    let mut conn = pool.get().await?;
    let key = daily_status_key(service_id, date);
    conn.set_ex::<_, _, ()>(key, status, DAILY_STATUS_TTL_SECONDS).await?;
    Ok(())
}

pub async fn get_daily_statuses(
    pool: &Pool,
    service_id: &str,
    dates: &[String],
) -> anyhow::Result<Vec<Option<String>>> {
    let mut conn = pool.get().await?;
    let keys: Vec<String> = dates
        .iter()
        .map(|date| daily_status_key(service_id, date))
        .collect();
    let values: Vec<Option<String>> = deadpool_redis::redis::cmd("MGET")
        .arg(&keys)
        .query_async(&mut conn)
        .await?;
    Ok(values)
}
