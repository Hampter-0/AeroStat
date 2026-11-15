use std::collections::HashMap;

use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Duration, DurationRound, Utc};
use serde::Serialize;

use crate::auth::CurrentUser;
use crate::db::HISTORY_DAYS;
use crate::error::ApiError;
use crate::state::AppState;

const HOURS: i64 = 24;

#[derive(Serialize)]
pub struct HourPoint {
    hour: DateTime<Utc>,
    avg_ms: Option<f64>,
}

#[derive(Serialize)]
pub struct ServiceResponseTimes {
    service_id: String,
    points: Vec<HourPoint>,
}

#[derive(Serialize)]
pub struct Stats {
    days: i32,
    incidents: i64,
    mean_minutes_to_resolve: Option<f64>,
    downtime_minutes: i64,
}

#[derive(Serialize)]
pub struct Dashboard {
    response_times: Vec<ServiceResponseTimes>,
    stats: Stats,
}

#[derive(sqlx::FromRow)]
struct HourRow {
    service_id: String,
    hour: DateTime<Utc>,
    avg_ms: Option<f64>,
}

pub async fn get(State(state): State<AppState>, _user: CurrentUser) -> Result<Json<Dashboard>, ApiError> {
    let current_hour = Utc::now()
        .duration_trunc(Duration::hours(1))
        .map_err(|e| ApiError::Internal(e.into()))?;
    let first_hour = current_hour - Duration::hours(HOURS - 1);

    let services: Vec<(String,)> = sqlx::query_as("SELECT id FROM services ORDER BY sort_order, name")
        .fetch_all(&state.db)
        .await?;

    // Only online checks count: a timeout says nothing about speed.
    let rows: Vec<HourRow> = sqlx::query_as(
        r#"
        SELECT service_id,
               date_trunc('hour', checked_at) AS hour,
               AVG(response_time) FILTER (WHERE status = 'online')::float8 AS avg_ms
        FROM metrics
        WHERE checked_at >= $1
        GROUP BY service_id, date_trunc('hour', checked_at)
        "#,
    )
    .bind(first_hour)
    .fetch_all(&state.db)
    .await?;

    let mut by_key: HashMap<(String, DateTime<Utc>), Option<f64>> = HashMap::new();
    for row in rows {
        by_key.insert((row.service_id, row.hour), row.avg_ms);
    }

    let mut response_times = Vec::new();
    for (service_id,) in services {
        let mut points = Vec::new();
        for offset in 0..HOURS {
            let hour = first_hour + Duration::hours(offset);
            let avg_ms = by_key.get(&(service_id.clone(), hour)).copied().flatten();
            points.push(HourPoint { hour, avg_ms: avg_ms.map(|v| v.round()) });
        }
        response_times.push(ServiceResponseTimes { service_id, points });
    }

    let (incidents, mean_minutes_to_resolve): (i64, Option<f64>) = sqlx::query_as(
        r#"
        SELECT COUNT(*),
               (AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE resolved_at IS NOT NULL) / 60)::float8
        FROM incidents
        WHERE created_at >= now() - make_interval(days => $1)
        "#,
    )
    .bind(HISTORY_DAYS as i32)
    .fetch_one(&state.db)
    .await?;

    let (downtime_seconds,): (Option<i64>,) = sqlx::query_as(
        r#"
        SELECT SUM(s.check_interval_seconds)::bigint
        FROM metrics m
        JOIN services s ON s.id = m.service_id
        WHERE m.status = 'offline' AND m.checked_at >= now() - make_interval(days => $1)
        "#,
    )
    .bind(HISTORY_DAYS as i32)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(Dashboard {
        response_times,
        stats: Stats {
            days: HISTORY_DAYS as i32,
            incidents,
            mean_minutes_to_resolve: mean_minutes_to_resolve.map(|v| v.round()),
            downtime_minutes: (downtime_seconds.unwrap_or(0) + 59) / 60,
        },
    }))
}
