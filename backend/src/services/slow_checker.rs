//! Warns when services answer much slower than usual. A service counts as
//! slow when enough of its last checks were slow (3 of the last 5 by default,
//! so one hiccup stays quiet). A check is slow when it is much slower
//! than the median of the week before, or above the service's own limit.
//! Services that turn slow at the same moment share one message.

use std::time::Duration;

use sqlx::PgPool;

use crate::notifications::{self, Event, SlowService};
use crate::site_settings;

const EVERY: Duration = Duration::from_secs(60);
/// Below this difference a check is never slower than usual, so 20 ms turning
/// into 45 ms doesn't count.
const MIN_EXTRA_MS: f64 = 100.0;
const MIN_USUAL_CHECKS: i64 = 20;

#[derive(sqlx::FromRow)]
struct Row {
    id: String,
    slow_since: Option<chrono::DateTime<chrono::Utc>>,
    slow_above_ms: Option<i32>,
    slow_alerts: bool,
    times: Option<Vec<i32>>,
    statuses: Option<Vec<String>>,
    usual_ms: Option<f64>,
    usual_count: i64,
    in_maintenance: bool,
}

pub fn spawn(db: PgPool) {
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(120)).await;
        loop {
            if let Err(e) = run(&db).await {
                tracing::error!("Slow response check failed: {e}");
            }
            tokio::time::sleep(EVERY).await;
        }
    });
}

fn median(values: &[i32]) -> i32 {
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    let middle = sorted.len() / 2;
    if sorted.len() % 2 == 0 {
        (sorted[middle - 1] + sorted[middle]) / 2
    } else {
        sorted[middle]
    }
}

pub async fn run(db: &PgPool) -> anyhow::Result<()> {
    let percent = site_settings::slow_alert_percent(db).await;
    let (needed, window) = site_settings::slow_rule(db).await;

    let rows: Vec<Row> = sqlx::query_as(
        r#"
        SELECT s.id, s.slow_since, s.slow_above_ms, s.slow_alerts, r.times, r.statuses, u.usual_ms, u.usual_count,
            EXISTS (
                SELECT 1 FROM maintenance m WHERE s.id = ANY(m.affected_services) AND m.status = 'in_progress'
            ) AS in_maintenance
        FROM services s
        CROSS JOIN LATERAL (
            SELECT array_agg(response_time ORDER BY checked_at DESC) AS times,
                   array_agg(status ORDER BY checked_at DESC) AS statuses,
                   MIN(checked_at) AS first_at
            FROM (
                SELECT response_time, status, checked_at FROM metrics
                WHERE service_id = s.id
                  AND checked_at >= now() - make_interval(secs => s.check_interval_seconds * $1 * 2 + 120)
                ORDER BY checked_at DESC
                LIMIT $1
            ) recent
        ) r
        CROSS JOIN LATERAL (
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY response_time)::float8 AS usual_ms, COUNT(*) AS usual_count
            FROM metrics
            WHERE service_id = s.id AND status = 'online'
              AND checked_at >= now() - interval '7 days'
              AND checked_at < COALESCE(r.first_at, now())
        ) u
        "#,
    )
    .bind(window as i32)
    .fetch_all(db)
    .await?;

    let factor = percent.map(|percent| 1.0 + percent as f64 / 100.0);
    let mut slow: Vec<SlowService> = Vec::new();
    let mut normal: Vec<String> = Vec::new();
    let mut quiet: Vec<String> = Vec::new();

    for row in rows {
        if !row.slow_alerts {
            if row.slow_since.is_some() {
                quiet.push(row.id);
            }
            continue;
        }
        let (Some(times), Some(statuses)) = (row.times, row.statuses) else {
            continue;
        };
        // Only a full window of checks that were all up says anything about speed.
        if times.len() < window as usize || statuses.iter().any(|status| status != "online") {
            continue;
        }

        let usual = match (factor, row.usual_ms) {
            (Some(factor), Some(usual)) if row.usual_count >= MIN_USUAL_CHECKS => Some((usual, factor)),
            _ => None,
        };
        let is_slow = |ms: i32| {
            let ms = ms as f64;
            let slower_than_usual = usual.is_some_and(|(usual, factor)| ms >= usual * factor && ms - usual >= MIN_EXTRA_MS);
            let above_limit = row.slow_above_ms.is_some_and(|limit| ms > limit as f64);
            slower_than_usual || above_limit
        };
        let slow_count = times.iter().filter(|ms| is_slow(**ms)).count() as i64;
        let typical = median(&times);

        if row.slow_since.is_none() {
            if slow_count >= needed && !row.in_maintenance {
                slow.push(SlowService {
                    id: row.id,
                    ms: typical,
                    usual_ms: usual.map(|(usual, _)| usual.round() as i32),
                    limit_ms: row.slow_above_ms,
                });
            }
        } else if slow_count < needed {
            normal.push(row.id);
        } else {
            sqlx::query("UPDATE services SET slow_ms = $2 WHERE id = $1")
                .bind(&row.id)
                .bind(typical)
                .execute(db)
                .await?;
        }
    }

    for service in &slow {
        sqlx::query("UPDATE services SET slow_since = now(), slow_ms = $2, slow_usual_ms = $3 WHERE id = $1")
            .bind(&service.id)
            .bind(service.ms)
            .bind(service.usual_ms.or(service.limit_ms))
            .execute(db)
            .await?;
    }
    let cleared: Vec<String> = normal.iter().chain(quiet.iter()).cloned().collect();
    if !cleared.is_empty() {
        sqlx::query("UPDATE services SET slow_since = NULL, slow_ms = NULL, slow_usual_ms = NULL WHERE id = ANY($1)")
            .bind(&cleared)
            .execute(db)
            .await?;
    }

    if !slow.is_empty() {
        tracing::info!("{} service(s) answer slower than usual", slow.len());
        notifications::notify(db, Event::ResponseSlow { services: slow });
    }
    if !normal.is_empty() {
        notifications::notify(db, Event::ResponseNormal { services: normal });
    }
    Ok(())
}
