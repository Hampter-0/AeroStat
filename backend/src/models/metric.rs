use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CheckResult {
    pub service_id: String,
    pub status: String,
    pub response_time_ms: i32,
    pub status_code: Option<i32>,
    /// Why the check failed, empty when it was fine.
    pub error: Option<String>,
}