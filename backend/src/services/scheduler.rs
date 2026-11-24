use std::time::Duration;

use sqlx::PgPool;

use crate::db;
use crate::notifications;
use crate::services::checker::{certificate_expiry, check_service, CheckableService};

const TICK: Duration = Duration::from_secs(5);
/// Certificates change rarely, so their expiry date is read at most this often.
const CERTIFICATE_HOURS: i64 = 6;

/// Sent with every check. Firewalls such as Cloudflare often refuse requests
/// without a user agent, which would show a healthy site as down.
const USER_AGENT: &str = concat!("AeroStat/", env!("CARGO_PKG_VERSION"), " (+https://github.com/Hampter-0/AeroStat)");

/// One loop for all services: every tick it claims the services whose
/// `next_check_at` has passed and checks them. Services added, edited or
/// deleted in the panel are picked up on the next tick, no restart needed.
pub fn spawn_all(pool: PgPool) {
    tokio::spawn(async move {
        let client = match reqwest::Client::builder().user_agent(USER_AGENT).build() {
            Ok(client) => client,
            Err(e) => {
                tracing::error!("Could not set up the HTTP client, checks are not running: {e}");
                return;
            }
        };
        loop {
            match claim_due(&pool).await {
                Ok(services) => {
                    for service in services {
                        tokio::spawn(run_check(pool.clone(), client.clone(), service));
                    }
                }
                Err(e) => tracing::error!("Could not load services to check: {e}"),
            }
            tokio::time::sleep(TICK).await;
        }
    });
}

/// Moves `next_check_at` forward in the same statement that selects the
/// services, so a slow check is never started twice.
async fn claim_due(pool: &PgPool) -> anyhow::Result<Vec<CheckableService>> {
    let services = sqlx::query_as(
        r#"
        UPDATE services
        SET next_check_at = now() + make_interval(secs => GREATEST(check_interval_seconds, 1))
        WHERE next_check_at <= now()
        RETURNING id, check_type, url, expected_status, keyword, keyword_absent, dns_record_type, dns_expected,
                  cert_warn_days, cert_checked_at,
                  (SELECT address FROM docker_hosts WHERE docker_hosts.id = services.docker_host_id) AS docker_address
        "#,
    )
    .fetch_all(pool)
    .await?;
    Ok(services)
}

async fn run_check(pool: PgPool, client: reqwest::Client, service: CheckableService) {
    let result = check_service(&client, &service).await;

    if let Err(e) = db::record(&pool, &result).await {
        tracing::warn!("Could not record check for {} (deleted meanwhile?): {e}", result.service_id);
        return;
    }

    tracing::info!(
        "Checked {} -> {} ({}ms)",
        service.id,
        result.status,
        result.response_time_ms
    );

    notifications::after_check(&pool, &service.id).await;

    if certificate_due(&service) {
        check_certificate(&pool, &service).await;
    }
}

fn certificate_due(service: &CheckableService) -> bool {
    let https = service.check_type == "http" && service.url.to_lowercase().starts_with("https://");
    let stale = match service.cert_checked_at {
        Some(at) => chrono::Utc::now() - at >= chrono::Duration::hours(CERTIFICATE_HOURS),
        None => true,
    };
    https && service.cert_warn_days.is_some() && stale
}

/// Saves when the certificate runs out and warns once per certificate when
/// that is within the chosen number of days. A renewed certificate has a new
/// date, so it can warn again later.
async fn check_certificate(pool: &PgPool, service: &CheckableService) {
    let expires = match certificate_expiry(&service.url).await {
        Ok(expires) => Some(expires),
        Err(e) => {
            tracing::debug!("Could not read the certificate of {}: {e}", service.id);
            None
        }
    };
    let saved = sqlx::query("UPDATE services SET cert_expires_at = COALESCE($1, cert_expires_at), cert_checked_at = now() WHERE id = $2")
        .bind(expires)
        .bind(&service.id)
        .execute(pool)
        .await;
    if let Err(e) = saved {
        tracing::warn!("Could not save the certificate date of {}: {e}", service.id);
        return;
    }
    let (Some(expires), Some(days)) = (expires, service.cert_warn_days) else {
        return;
    };
    if expires - chrono::Utc::now() > chrono::Duration::days(days as i64) {
        return;
    }
    let claimed = sqlx::query(
        "UPDATE services SET cert_warned_for = $1 WHERE id = $2 AND cert_warned_for IS DISTINCT FROM $1",
    )
    .bind(expires)
    .bind(&service.id)
    .execute(pool)
    .await;
    if let Ok(result) = claimed {
        if result.rows_affected() == 1 {
            notifications::notify(
                pool,
                notifications::Event::CertificateExpiring {
                    service_id: service.id.clone(),
                    expires_at: expires,
                },
            );
        }
    }
}
