use chrono::{DateTime, Utc};
use serde::Serialize;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StatusUpdate {
    pub id: i64,
    pub status: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
}
