use deadpool_redis::{Config, Pool, Runtime};
use deadpool_redis::redis::AsyncCommands;

/// Creates a Redis connection pool from a connection URL like
/// "redis://localhost:6379".
pub fn connect(redis_url: &str) -> anyhow::Result<Pool> {
    let config = Config::from_url(redis_url);
    let pool = config.create_pool(Some(Runtime::Tokio1))?;
    Ok(pool)
}

/// Stores one day's rollup status for a service. Key format:
/// uptime:<service_id>:<date>  →  "online" | "degraded" | "offline"
pub async fn set_daily_status(
    pool: &Pool,
    service_id: &str,
    date: &str,
    status: &str,
) -> anyhow::Result<()> {
    let mut conn = pool.get().await?;
    let key = format!("uptime:{service_id}:{date}");
    conn.set::<_, _, ()>(key, status).await?;
    Ok(())
}

/// Reads the rollup status for one service on one day, or None if
/// nothing has been stored yet for that day.

#[allow(dead_code)]
pub async fn get_daily_status(
    pool: &Pool,
    service_id: &str,
    date: &str,
) -> anyhow::Result<Option<String>> {
    let mut conn = pool.get().await?;
    let key = format!("uptime:{service_id}:{date}");
    let value: Option<String> = conn.get(key).await?;
    Ok(value)
}