use std::time::Instant;

use crate::models::CheckResult;

/// A service as read from the database 
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CheckableService {
    pub id: String,
    pub url: String,
    pub expected_status: Vec<i32>,
}

/// Performs a single HTTP(S) check against one service and returns the result
pub async fn check_service(client: &reqwest::Client, service: &CheckableService) -> CheckResult {
    let start = Instant::now();

    let result = client
        .get(&service.url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    let response_time_ms = start.elapsed().as_millis() as i32;

    match result {
        Ok(response) => {
            let status_code = response.status().as_u16() as i32;
            let status = if service.expected_status.contains(&status_code) {
                "online"
            } else {
                "offline"
            };

            CheckResult {
                service_id: service.id.clone(),
                status: status.into(),
                response_time_ms,
                status_code: Some(status_code),
            }
        }
        Err(_) => CheckResult {
            service_id: service.id.clone(),
            status: "offline".into(),
            response_time_ms,
            status_code: None,
        },
    }
}