use chrono::{DateTime, Utc};
use deadpool_redis::Pool as RedisPool;
use sqlx::PgPool;

use crate::login_guard::LoginLimits;
use crate::services::update_checker::UpdateCache;

#[derive(Clone)]
#[allow(dead_code)]
pub struct AppState {
    pub db: PgPool,
    pub redis: RedisPool,
    pub default_retention_days: i32,
    pub login_limits: LoginLimits,
    pub session_days: i32,
    pub update_check: bool,
    pub update_state: UpdateCache,
    pub started_at: DateTime<Utc>,
}