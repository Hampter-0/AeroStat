use chrono::NaiveDate;
use sqlx::PgPool;

use crate::db::redis::set_daily_status;
use deadpool_redis::Pool as RedisPool;

#[derive(sqlx::FromRow)]
struct DayCounts {
    total_checks: i64,
    offline_checks: i64,
}

/// Computes yesterday's rollup status for every service and stores
/// each result in Redis. Rule: all checks offline -> "offline", some
/// checks offline -> "degraded", otherwise -> "online".
pub async fn rollup_yesterday(db: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
    let yesterday: NaiveDate = (chrono::Utc::now() - chrono::Duration::days(1)).date_naive();
    let date_text = yesterday.format("%Y-%m-%d").to_string();

    let service_ids: Vec<(String,)> = sqlx::query_as("SELECT id FROM services")
        .fetch_all(db)
        .await?;

    for (service_id,) in service_ids {
        let counts: DayCounts = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) AS total_checks,
                SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) AS offline_checks
            FROM metrics
            WHERE service_id = $1
            AND checked_at >= $2::date
            AND checked_at < $2::date + interval '1 day'
            "#,
        )
        .bind(&service_id)
        .bind(yesterday)
        .fetch_one(db)
        .await?;

        if counts.total_checks == 0 {
            continue;
        }

        let status = if counts.offline_checks == counts.total_checks {
            "offline"
        } else if counts.offline_checks > 0 {
            "degraded"
        } else {
            "online"
        };

        set_daily_status(redis, &service_id, &date_text, status).await?;
    }

    tracing::info!("Rolled up {date_text} status into Redis");

    Ok(())
}