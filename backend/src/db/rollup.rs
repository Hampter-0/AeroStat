use chrono::{Duration, NaiveDate, Utc};
use sqlx::PgPool;

use crate::db::redis::set_daily_status;
use deadpool_redis::Pool as RedisPool;

pub const HISTORY_DAYS: i64 = 60;

#[derive(sqlx::FromRow)]
struct DayCounts {
    total_checks: i64,
    offline_checks: Option<i64>,
    downtime_seconds: Option<i64>,
}

pub struct DayRollup {
    pub status: &'static str,
    /// Estimated: every offline check counts as one check interval down.
    pub downtime_minutes: i64,
}

impl DayRollup {
    pub fn to_redis_value(&self) -> String {
        format!("{}:{}", self.status, self.downtime_minutes)
    }
}

/// Computes one service's status for one UTC day from its checks.
/// Rule: all checks offline -> "offline", some checks offline ->
/// "degraded", otherwise -> "online". None if there were no checks.
pub async fn day_status(
    db: &PgPool,
    service_id: &str,
    date: NaiveDate,
) -> anyhow::Result<Option<DayRollup>> {
    let counts: DayCounts = sqlx::query_as(
        r#"
        SELECT
            COUNT(*) AS total_checks,
            SUM(CASE WHEN m.status = 'offline' THEN 1 ELSE 0 END) AS offline_checks,
            SUM(CASE WHEN m.status = 'offline' THEN s.check_interval_seconds ELSE 0 END)::bigint AS downtime_seconds
        FROM metrics m
        JOIN services s ON s.id = m.service_id
        WHERE m.service_id = $1
        AND m.checked_at >= $2::date
        AND m.checked_at < $2::date + interval '1 day'
        "#,
    )
    .bind(service_id)
    .bind(date)
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
    }))
}

pub async fn rollup_day(db: &PgPool, redis: &RedisPool, date: NaiveDate) -> anyhow::Result<()> {
    let date_text = date.format("%Y-%m-%d").to_string();

    let service_ids: Vec<(String,)> = sqlx::query_as("SELECT id FROM services")
        .fetch_all(db)
        .await?;

    for (service_id,) in service_ids {
        if let Some(rollup) = day_status(db, &service_id, date).await? {
            set_daily_status(redis, &service_id, &date_text, &rollup.to_redis_value()).await?;
        }
    }

    Ok(())
}

pub async fn rollup_yesterday(db: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
    let yesterday = (Utc::now() - Duration::days(1)).date_naive();
    rollup_day(db, redis, yesterday).await?;
    tracing::info!("Rolled up {yesterday} status into Redis");
    Ok(())
}

pub async fn backfill(db: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
    let today = Utc::now().date_naive();
    let mut days_back = 1;
    while days_back < HISTORY_DAYS {
        rollup_day(db, redis, today - Duration::days(days_back)).await?;
        days_back += 1;
    }
    tracing::info!("Backfilled {} days of uptime history into Redis", HISTORY_DAYS - 1);
    Ok(())
}
