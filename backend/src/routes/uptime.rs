use axum::{extract::Path, extract::State, Json};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use chrono_tz::Tz;
use serde::Serialize;

use crate::db::{day_status, get_daily_statuses, HISTORY_DAYS};
use crate::site_settings;
use crate::state::AppState;

#[derive(Serialize)]
pub struct UptimeStats {
    service_id: String,
    uptime_percent: f64,
    avg_response_time_ms: i64,
    total_checks: i64,
    period_days: i32,
    days: Vec<DayHistory>,
}

#[derive(Serialize)]
pub struct DayHistory {
    date: String,
    /// "online" | "degraded" | "offline" | "no_data"
    status: String,
    downtime_minutes: i64,
    events: Vec<DayEvent>,
}

#[derive(Serialize, Clone)]
pub struct DayEvent {
    kind: &'static str,
    id: i64,
    title: String,
}

#[derive(sqlx::FromRow)]
struct UptimeRow {
    total_checks: Option<i64>,
    online_checks: Option<i64>,
    avg_response_time: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct EventRow {
    id: i64,
    title: String,
    starts_at: DateTime<Utc>,
    ends_at: DateTime<Utc>,
}

pub async fn get(
    State(state): State<AppState>,
    Path(service_id): Path<String>,
) -> Json<UptimeStats> {
    let tz = site_settings::timezone(&state.db).await;
    let first_day = site_settings::today(tz) - Duration::days(HISTORY_DAYS - 1);
    let window_start = site_settings::start_of_day(first_day, tz);

    let row: UptimeRow = sqlx::query_as(
    r#"
    SELECT
        COUNT(*) AS total_checks,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online_checks,
        AVG(CASE WHEN status = 'online' THEN response_time ELSE NULL END)::float8 AS avg_response_time
    FROM metrics
    WHERE service_id = $1
    AND checked_at >= $2
    "#,
)
    .bind(&service_id)
    .bind(window_start)
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

    let days = day_history(&state, &service_id).await.unwrap_or_else(|e| {
        tracing::error!("Uptime history for {service_id} failed: {e}");
        Vec::new()
    });

    Json(UptimeStats {
        service_id,
        uptime_percent: (uptime_percent * 100.0).round() / 100.0,
        avg_response_time_ms: row.avg_response_time.unwrap_or(0.0).round() as i64,
        total_checks: total,
        period_days: HISTORY_DAYS as i32,
        days,
    })
}

/// Past days come from Redis, today is computed live, events come straight from Postgres.
async fn day_history(state: &AppState, service_id: &str) -> anyhow::Result<Vec<DayHistory>> {
    let tz = site_settings::timezone(&state.db).await;
    let today = site_settings::today(tz);
    let first_day = today - Duration::days(HISTORY_DAYS - 1);

    let mut dates: Vec<NaiveDate> = Vec::new();
    let mut date = first_day;
    while date <= today {
        dates.push(date);
        date += Duration::days(1);
    }

    let date_texts: Vec<String> = dates
        .iter()
        .map(|d| d.format("%Y-%m-%d").to_string())
        .collect();

    let mut statuses = get_daily_statuses(&state.redis, service_id, &date_texts).await?;
    let today_status = day_status(&state.db, service_id, today, tz).await?;
    if let Some(last) = statuses.last_mut() {
        *last = today_status.map(|rollup| rollup.to_redis_value());
    }

    let window_start = site_settings::start_of_day(first_day, tz);

    let incidents: Vec<EventRow> = sqlx::query_as(
        r#"
        SELECT id, title, created_at AS starts_at, COALESCE(resolved_at, now()) AS ends_at
        FROM incidents
        WHERE $1 = ANY(affected_services)
        AND COALESCE(resolved_at, now()) >= $2
        ORDER BY created_at DESC
        "#,
    )
    .bind(service_id)
    .bind(window_start)
    .fetch_all(&state.db)
    .await?;

    let maintenance: Vec<EventRow> = sqlx::query_as(
        r#"
        SELECT id, title, scheduled_start AS starts_at, LEAST(scheduled_end, now()) AS ends_at
        FROM maintenance
        WHERE $1 = ANY(affected_services)
        AND status <> 'cancelled'
        AND scheduled_start <= now()
        AND scheduled_end >= $2
        ORDER BY scheduled_start DESC
        "#,
    )
    .bind(service_id)
    .bind(window_start)
    .fetch_all(&state.db)
    .await?;

    let mut history = Vec::new();
    for (i, date) in dates.iter().enumerate() {
        let mut events = Vec::new();
        for incident in &incidents {
            if covers_day(incident, *date, tz) {
                events.push(DayEvent {
                    kind: "incident",
                    id: incident.id,
                    title: incident.title.clone(),
                });
            }
        }
        for window in &maintenance {
            if covers_day(window, *date, tz) {
                events.push(DayEvent {
                    kind: "maintenance",
                    id: window.id,
                    title: window.title.clone(),
                });
            }
        }

        let (status, downtime_minutes) = parse_rollup(statuses[i].as_deref());

        history.push(DayHistory {
            date: date_texts[i].clone(),
            status,
            downtime_minutes,
            events,
        });
    }

    Ok(history)
}

fn parse_rollup(value: Option<&str>) -> (String, i64) {
    match value {
        None => ("no_data".into(), 0),
        Some(text) => match text.split_once(':') {
            Some((status, minutes)) => (status.into(), minutes.parse().unwrap_or(0)),
            None => (text.into(), 0),
        },
    }
}

fn covers_day(event: &EventRow, date: NaiveDate, tz: Tz) -> bool {
    event.starts_at.with_timezone(&tz).date_naive() <= date && event.ends_at.with_timezone(&tz).date_naive() >= date
}
