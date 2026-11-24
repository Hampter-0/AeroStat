use axum::{extract::Path, extract::Query, extract::State, Json};
use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use serde::Deserialize;
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
    /// "online" | "degraded" | "offline" | "maintenance" | "no_data".
    /// Downtime during maintenance counts as maintenance, unless a critical
    /// incident made it an outage.
    status: String,
    downtime_minutes: i64,
    /// Share of the day the service was up, for the bar's tooltip. Today
    /// counts only the part that has passed. None without checks.
    uptime_percent: Option<f64>,
    /// Average response time of that day's checks that were up.
    avg_response_time_ms: Option<i64>,
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
    /// Incidents only; maintenance doesn't colour the bar.
    severity: Option<String>,
}

/// A critical incident counts as an outage, also when the checks missed it
/// or there were no checks yet. Other incidents only mark the day.
fn is_outage(event: &EventRow) -> bool {
    event.severity.as_deref() == Some("critical")
}

/// Minutes of the event that fall inside the day, up to now.
fn minutes_on_day(event: &EventRow, date: NaiveDate, tz: Tz) -> i64 {
    let (start, end) = site_settings::day_bounds(date, tz);
    let from = event.starts_at.max(start);
    let to = event.ends_at.min(end).min(Utc::now());
    (to - from).num_minutes().max(0)
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

    let today = site_settings::today(tz);
    let days = day_history(&state, &service_id, first_day, today).await.unwrap_or_else(|e| {
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

/// Past days come from Postgres, or Redis for days not saved there yet; today
/// is computed live. Events come straight from Postgres. `last_day` is at most
/// today.
async fn day_history(
    state: &AppState,
    service_id: &str,
    first_day: NaiveDate,
    last_day: NaiveDate,
) -> anyhow::Result<Vec<DayHistory>> {
    let tz = site_settings::timezone(&state.db).await;
    let today = site_settings::today(tz);
    let last_day = last_day.min(today);

    let mut dates: Vec<NaiveDate> = Vec::new();
    let mut date = first_day;
    while date <= last_day {
        dates.push(date);
        date += Duration::days(1);
    }
    if dates.is_empty() {
        return Ok(Vec::new());
    }

    let date_texts: Vec<String> = dates
        .iter()
        .map(|d| d.format("%Y-%m-%d").to_string())
        .collect();

    let saved: Vec<(NaiveDate, String, i32, Option<i32>)> = sqlx::query_as(
        "SELECT day, status, downtime_minutes, avg_response_ms FROM daily_uptime WHERE service_id = $1 AND day BETWEEN $2 AND $3",
    )
    .bind(service_id)
    .bind(first_day)
    .bind(last_day)
    .fetch_all(&state.db)
    .await?;
    let mut statuses = get_daily_statuses(&state.redis, service_id, &date_texts).await?;
    for (i, date) in dates.iter().enumerate() {
        if let Some((_, status, minutes, avg)) = saved.iter().find(|row| row.0 == *date) {
            let avg = avg.map(|ms| ms.to_string()).unwrap_or_default();
            statuses[i] = Some(format!("{status}:{minutes}:{avg}"));
        }
    }
    if last_day == today {
        let today_status = day_status(&state.db, service_id, today, tz).await?;
        if let Some(last) = statuses.last_mut() {
            *last = today_status.map(|rollup| rollup.to_redis_value());
        }
    }

    let window_start = site_settings::start_of_day(first_day, tz);
    let window_end = site_settings::start_of_day(last_day + Duration::days(1), tz);

    let incidents: Vec<EventRow> = sqlx::query_as(
        r#"
        SELECT id, title, created_at AS starts_at, COALESCE(resolved_at, now()) AS ends_at, severity
        FROM incidents
        WHERE $1 = ANY(affected_services)
        AND COALESCE(resolved_at, now()) >= $2
        AND created_at < $3
        ORDER BY created_at DESC
        "#,
    )
    .bind(service_id)
    .bind(window_start)
    .bind(window_end)
    .fetch_all(&state.db)
    .await?;

    let maintenance: Vec<EventRow> = sqlx::query_as(
        r#"
        SELECT id, title, scheduled_start AS starts_at, LEAST(scheduled_end, now()) AS ends_at,
            NULL::text AS severity
        FROM maintenance
        WHERE $1 = ANY(affected_services)
        AND status <> 'cancelled'
        AND scheduled_start <= now()
        AND scheduled_end >= $2
        AND scheduled_start < $3
        ORDER BY scheduled_start DESC
        "#,
    )
    .bind(service_id)
    .bind(window_start)
    .bind(window_end)
    .fetch_all(&state.db)
    .await?;

    let mut history = Vec::new();
    for (i, date) in dates.iter().enumerate() {
        let (mut status, mut downtime_minutes, avg_response_time_ms) = parse_rollup(statuses[i].as_deref());
        let checked = status != "no_data";
        let mut events = Vec::new();
        let mut outage = false;
        let mut in_maintenance = false;
        for incident in &incidents {
            if covers_day(incident, *date, tz) {
                if is_outage(incident) {
                    outage = true;
                    status = "offline".to_string();
                    // The checks may have seen part of it; take whichever saw more.
                    downtime_minutes = downtime_minutes.max(minutes_on_day(incident, *date, tz));
                }
                events.push(DayEvent {
                    kind: "incident",
                    id: incident.id,
                    title: incident.title.clone(),
                });
            }
        }
        for window in &maintenance {
            if covers_day(window, *date, tz) {
                in_maintenance = true;
                events.push(DayEvent {
                    kind: "maintenance",
                    id: window.id,
                    title: window.title.clone(),
                });
            }
        }

        if in_maintenance && !outage && (status == "offline" || status == "degraded") {
            status = "maintenance".to_string();
        }

        let uptime_percent = if !checked {
            None
        } else {
            let (start, end) = site_settings::day_bounds(*date, tz);
            let minutes = (end.min(Utc::now()) - start).num_minutes().max(1);
            let share = 1.0 - (downtime_minutes as f64 / minutes as f64);
            Some((share.clamp(0.0, 1.0) * 100_000.0).round() / 1000.0)
        };

        history.push(DayHistory {
            date: date_texts[i].clone(),
            status,
            downtime_minutes,
            uptime_percent,
            avg_response_time_ms,
            events,
        });
    }

    Ok(history)
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    /// 0 is the three months up to now, -1 the three before, and so on.
    page: Option<i32>,
}

#[derive(Serialize)]
pub struct MonthHistory {
    year: i32,
    month: u32,
    /// Share of the checked time the service was up. None without checks.
    uptime_percent: Option<f64>,
    days: Vec<DayHistory>,
}

#[derive(Serialize)]
pub struct UptimeHistory {
    service_id: String,
    months: Vec<MonthHistory>,
    has_older: bool,
}

fn month_start(year: i32, month: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(NaiveDate::MIN)
}

fn shift_month(year: i32, month: u32, by: i32) -> (i32, u32) {
    let index = year * 12 + month as i32 - 1 + by;
    (index.div_euclid(12), (index.rem_euclid(12) + 1) as u32)
}

/// Uptime per day for three calendar months, oldest first, for the history
/// page. Days keep their colours and events like the bars.
pub async fn history(
    State(state): State<AppState>,
    Path(service_id): Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Json<UptimeHistory> {
    let tz = site_settings::timezone(&state.db).await;
    let today = site_settings::today(tz);
    let page = query.page.unwrap_or(0).clamp(-120, 0);

    let mut months = Vec::new();
    let mut offset = -2;
    while offset <= 0 {
        let (year, month) = shift_month(today.year(), today.month(), page * 3 + offset);
        let first = month_start(year, month);
        let (next_year, next_month) = shift_month(year, month, 1);
        let last = month_start(next_year, next_month) - Duration::days(1);
        let days = day_history(&state, &service_id, first, last).await.unwrap_or_else(|e| {
            tracing::error!("Uptime history for {service_id} failed: {e}");
            Vec::new()
        });
        months.push(MonthHistory {
            year,
            month,
            uptime_percent: month_uptime(&days, tz),
            days,
        });
        offset += 1;
    }

    let (first_year, first_month) = shift_month(today.year(), today.month(), page * 3 - 2);
    let range_start = month_start(first_year, first_month);
    let has_older: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (SELECT 1 FROM daily_uptime WHERE service_id = $1 AND day < $2)
            OR EXISTS (SELECT 1 FROM metrics WHERE service_id = $1 AND checked_at < $3)
        "#,
    )
    .bind(&service_id)
    .bind(range_start)
    .bind(site_settings::start_of_day(range_start, tz))
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    Json(UptimeHistory { service_id, months, has_older })
}

/// Uptime over the checked days, weighted by how long each day was.
fn month_uptime(days: &[DayHistory], tz: Tz) -> Option<f64> {
    let mut total = 0i64;
    let mut down = 0i64;
    for day in days {
        if day.uptime_percent.is_none() {
            continue;
        }
        let Ok(date) = NaiveDate::parse_from_str(&day.date, "%Y-%m-%d") else {
            continue;
        };
        let (start, end) = site_settings::day_bounds(date, tz);
        let minutes = (end.min(Utc::now()) - start).num_minutes().max(1);
        total += minutes;
        down += day.downtime_minutes.min(minutes);
    }
    if total == 0 {
        return None;
    }
    let share = 1.0 - down as f64 / total as f64;
    Some((share.clamp(0.0, 1.0) * 100_000.0).round() / 1000.0)
}

/// Reads "status:minutes:avg_ms". Older values have only "status:minutes",
/// or just the status.
fn parse_rollup(value: Option<&str>) -> (String, i64, Option<i64>) {
    let Some(text) = value else {
        return ("no_data".into(), 0, None);
    };
    let mut parts = text.split(':');
    let status = parts.next().unwrap_or("no_data").to_string();
    let minutes = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    let avg = parts.next().and_then(|part| part.parse().ok());
    (status, minutes, avg)
}

fn covers_day(event: &EventRow, date: NaiveDate, tz: Tz) -> bool {
    event.starts_at.with_timezone(&tz).date_naive() <= date && event.ends_at.with_timezone(&tz).date_naive() >= date
}
