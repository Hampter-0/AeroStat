use axum::{extract::Path, extract::State, Json};
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
pub struct UptimeStats {
    service_id: String,
    uptime_percent: f64,
    avg_response_time_ms: i64,
    total_checks: i64,
    period_days: i32,
}

#[derive(sqlx::FromRow)]
struct UptimeRow {
    total_checks: Option<i64>,
    online_checks: Option<i64>,
    avg_response_time: Option<f64>,
}

pub async fn get(
    State(state): State<AppState>,
    Path(service_id): Path<String>,
) -> Json<UptimeStats> {
    let row: UptimeRow = sqlx::query_as(
    r#"
    SELECT
        COUNT(*) AS total_checks,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online_checks,
        AVG(CASE WHEN status = 'online' THEN response_time ELSE NULL END)::float8 AS avg_response_time
    FROM metrics
    WHERE service_id = $1
    AND checked_at >= now() - interval '90 days'
    "#,
)
    .bind(&service_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(UptimeRow {
        total_checks: Some(0),
        online_checks: Some(0),
        avg_response_time: None,
    });

    let total = row.total_checks.unwrap_or(0);
    let online = row.online_checks.unwrap_or(0);

    let uptime_percent = if total > 0 {
        (online as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Json(UptimeStats {
        service_id,
        uptime_percent: (uptime_percent * 100.0).round() / 100.0,
        avg_response_time_ms: row.avg_response_time.unwrap_or(0.0).round() as i64,
        total_checks: total,
        period_days: 90,
    })
}
