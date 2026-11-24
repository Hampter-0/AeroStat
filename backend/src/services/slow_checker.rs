//! Warns when services answer much slower than usual. Every few minutes the
//! average of the last checks is compared with the median of the week before.
//! Services that turn slow at the same moment share one message.

use std::time::Duration;

use sqlx::PgPool;

use crate::notifications::{self, Event, SlowService};
use crate::site_settings;

const EVERY: Duration = Duration::from_secs(5 * 60);
/// Below this difference a service is never called slow, so 20 ms turning
/// into 45 ms doesn't send anything.
const MIN_EXTRA_MS: f64 = 100.0;
const MIN_RECENT_CHECKS: i64 = 3;
const MIN_USUAL_CHECKS: i64 = 20;

#[derive(sqlx::FromRow)]
struct Row {
    id: String,
    slow_since: Option<chrono::DateTime<chrono::Utc>>,
    recent_ms: Option<f64>,
    recent_count: i64,
    usual_ms: Option<f64>,
    usual_count: i64,
    last_status: Option<String>,
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

pub async fn run(db: &PgPool) -> anyhow::Result<()> {
    let Some(percent) = site_settings::slow_alert_percent(db).await else {
        sqlx::query("UPDATE services SET slow_since = NULL, slow_ms = NULL, slow_usual_ms = NULL WHERE slow_since IS NOT NULL")
            .execute(db)
            .await?;
        return Ok(());
    };

    let rows: Vec<Row> = sqlx::query_as(
        r#"
        SELECT s.id, s.slow_since, r.recent_ms, r.recent_count, u.usual_ms, u.usual_count,
            (SELECT status FROM metrics WHERE service_id = s.id ORDER BY checked_at DESC LIMIT 1) AS last_status,
            EXISTS (
                SELECT 1 FROM maintenance m WHERE s.id = ANY(m.affected_services) AND m.status = 'in_progress'
            ) AS in_maintenance
        FROM services s
        CROSS JOIN LATERAL (
            SELECT AVG(response_time)::float8 AS recent_ms, COUNT(*) AS recent_count, MIN(checked_at) AS recent_from
            FROM metrics
            WHERE service_id = s.id AND status = 'online'
              AND checked_at >= now() - make_interval(secs => GREATEST(300, s.check_interval_seconds * 3 + 60))
        ) r
        CROSS JOIN LATERAL (
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY response_time)::float8 AS usual_ms, COUNT(*) AS usual_count
            FROM metrics
            WHERE service_id = s.id AND status = 'online'
              AND checked_at >= now() - interval '7 days'
              AND checked_at < COALESCE(r.recent_from, now())
        ) u
        "#,
    )
    .fetch_all(db)
    .await?;

    let factor = 1.0 + percent as f64 / 100.0;
    let calm_factor = 1.0 + percent as f64 / 200.0;
    let mut slow: Vec<SlowService> = Vec::new();
    let mut normal: Vec<String> = Vec::new();

    for row in rows {
        let (Some(recent), Some(usual)) = (row.recent_ms, row.usual_ms) else {
            continue;
        };
        let enough = row.recent_count >= MIN_RECENT_CHECKS && row.usual_count >= MIN_USUAL_CHECKS;
        if row.slow_since.is_none() {
            let is_slow = enough
                && row.last_status.as_deref() == Some("online")
                && !row.in_maintenance
                && recent >= usual * factor
                && recent - usual >= MIN_EXTRA_MS;
            if is_slow {
                slow.push(SlowService {
                    id: row.id,
                    ms: recent.round() as i32,
                    usual_ms: usual.round() as i32,
                });
            }
        } else if row.recent_count >= MIN_RECENT_CHECKS && recent < usual * calm_factor {
            normal.push(row.id);
        } else if row.recent_count >= MIN_RECENT_CHECKS {
            sqlx::query("UPDATE services SET slow_ms = $2 WHERE id = $1")
                .bind(&row.id)
                .bind(recent.round() as i32)
                .execute(db)
                .await?;
        }
    }

    for service in &slow {
        sqlx::query("UPDATE services SET slow_since = now(), slow_ms = $2, slow_usual_ms = $3 WHERE id = $1")
            .bind(&service.id)
            .bind(service.ms)
            .bind(service.usual_ms)
            .execute(db)
            .await?;
    }
    if !normal.is_empty() {
        sqlx::query("UPDATE services SET slow_since = NULL, slow_ms = NULL, slow_usual_ms = NULL WHERE id = ANY($1)")
            .bind(&normal)
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
