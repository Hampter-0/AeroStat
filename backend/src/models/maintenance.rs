use chrono::{DateTime, Utc};
use serde::Serialize;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Maintenance {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub affected_services: Option<Vec<String>>,
    pub scheduled_start: DateTime<Utc>,
    pub scheduled_end: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}