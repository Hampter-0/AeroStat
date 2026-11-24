use chrono::{Duration, NaiveDate};
use chrono_tz::Tz;
use sqlx::PgPool;

use crate::site_settings;

use crate::db::redis::set_daily_status;
use deadpool_redis::Pool as RedisPool;

pub const HISTORY_DAYS: i64 = 60;

#[derive(sqlx::FromRow)]
struct DayCounts {
    total_checks: i64,
    offline_checks: Option<i64>,
    downtime_seconds: Option<i64>,
    avg_response_ms: Option<f64>,
}

pub struct DayRollup {
    pub status: &'static str,
    /// Estimated: every offline check counts as one check interval down.
    pub downtime_minutes: i64,
    /// Average response time of the checks that were up. None when none were.
    pub avg_response_ms: Option<i64>,
}

impl DayRollup {
    pub fn to_redis_value(&self) -> String {
        let avg = match self.avg_response_ms {
            Some(ms) => ms.to_string(),
            None => String::new(),
        };
        format!("{}:{}:{}", self.status, self.downtime_minutes, avg)
    }
}

/// Computes one service's status for one day in the site's timezone.
/// Rule: all checks offline -> "offline", some checks offline ->
/// "degraded", otherwise -> "online". None if there were no checks.
pub async fn day_status(
    db: &PgPool,
    service_id: &str,
    date: NaiveDate,
    tz: Tz,
) -> anyhow::Result<Option<DayRollup>> {
    let (start, end) = site_settings::day_bounds(date, tz);
    let counts: DayCounts = sqlx::query_as(
        r#"
        WITH checks AS (
            SELECT
                m.status,
                m.response_time,
                m.checked_at,
                LEAD(m.checked_at) OVER (ORDER BY m.checked_at) AS next_at,
                s.check_interval_seconds
            FROM metrics m
            JOIN services s ON s.id = m.service_id
            WHERE m.service_id = $1
            AND m.checked_at >= $2
            AND m.checked_at < $3
        )
        SELECT
            COUNT(*) AS total_checks,
            SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) AS offline_checks,
            -- An offline check counts until the next check, at most one interval,
            -- so an extra "check now" doesn't add a whole interval of downtime.
            SUM(CASE WHEN status = 'offline' THEN LEAST(
                EXTRACT(EPOCH FROM (COALESCE(next_at, LEAST(now(), $3)) - checked_at)),
                check_interval_seconds
            ) ELSE 0 END)::bigint AS downtime_seconds,
            AVG(response_time) FILTER (WHERE status = 'online')::float8 AS avg_response_ms
        FROM checks
        "#,
    )
    .bind(service_id)
    .bind(start)
    .bind(end)
    .fetch_one(db)
    .await?;

    if counts.total_checks == 0 {
        return Ok(None);
    }

    let offline_checks = counts.offline_checks.unwrap_or(0);

    let status = if offline_checks == counts.total_checks {
        "offline"
    } else if offline_checks > 0 {
        "degraded"
    } else {
        "online"
    };

    let downtime_minutes = (counts.downtime_seconds.unwrap_or(0) + 59) / 60;

    Ok(Some(DayRollup {
        status,
        downtime_minutes,
        avg_response_ms: counts.avg_response_ms.map(|ms| ms.round() as i64),
    }))
}

pub async fn rollup_day(db: &PgPool, redis: &RedisPool, date: NaiveDate, tz: Tz) -> anyhow::Result<()> {
    let date_text = date.format("%Y-%m-%d").to_string();

    let service_ids: Vec<(String,)> = sqlx::query_as("SELECT id FROM services")
        .fetch_all(db)
        .await?;

    for (service_id,) in service_ids {
        if let Some(rollup) = day_status(db, &service_id, date, tz).await? {
            set_daily_status(redis, &service_id, &date_text, &rollup.to_redis_value()).await?;
            save_day(db, &service_id, date, &rollup).await?;
        }
    }

    Ok(())
}

/// Keeps the day in Postgres too, where it stays after the checks are cleaned
/// up, for the uptime history.
async fn save_day(db: &PgPool, service_id: &str, date: NaiveDate, rollup: &DayRollup) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO daily_uptime (service_id, day, status, downtime_minutes, avg_response_ms)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (service_id, day) DO UPDATE
        SET status = EXCLUDED.status, downtime_minutes = EXCLUDED.downtime_minutes, avg_response_ms = EXCLUDED.avg_response_ms
        "#,
    )
    .bind(service_id)
    .bind(date)
    .bind(rollup.status)
    .bind(rollup.downtime_minutes as i32)
    .bind(rollup.avg_response_ms.map(|ms| ms as i32))
    .execute(db)
    .await?;
    Ok(())
}

pub async fn rollup_yesterday(db: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
    let tz = site_settings::timezone(db).await;
    let yesterday = site_settings::today(tz) - Duration::days(1);
    rollup_day(db, redis, yesterday, tz).await?;
    tracing::info!("Rolled up the uptime of {yesterday}");
    Ok(())
}

pub async fn backfill(db: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
    let tz = site_settings::timezone(db).await;
    let today = site_settings::today(tz);
    let mut days_back = 1;
    while days_back < HISTORY_DAYS {
        rollup_day(db, redis, today - Duration::days(days_back), tz).await?;
        days_back += 1;
    }
    tracing::info!("Backfilled {} days of uptime history", HISTORY_DAYS - 1);
    Ok(())
}
