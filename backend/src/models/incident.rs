use chrono::{DateTime, Utc};
use serde::Serialize;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Incident {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub severity: String,
    pub affected_services: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}