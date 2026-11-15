use deadpool_redis::Pool as RedisPool;
use sqlx::PgPool;

#[derive(Clone)]
#[allow(dead_code)]
pub struct AppState {
    pub db: PgPool,
    pub redis: RedisPool,
    pub default_retention_days: i32,
}