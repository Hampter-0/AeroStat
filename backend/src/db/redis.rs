use deadpool_redis::{Config, Pool, Runtime};

/// Creates a Redis connection pool from a connection URL like
/// "redis://localhost:6379".
pub fn connect(redis_url: &str) -> anyhow::Result<Pool> {
    let config = Config::from_url(redis_url);
    let pool = config.create_pool(Some(Runtime::Tokio1))?;
    Ok(pool)
}