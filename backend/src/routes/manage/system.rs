use std::time::Instant;

use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::auth::CurrentUser;
use crate::db::MIGRATOR;
use crate::error::ApiError;
use crate::services::update_checker::{is_newer, CURRENT_VERSION};
use crate::state::AppState;
use crate::system_info;

#[derive(Serialize)]
pub struct Overview {
    version: &'static str,
    cpu: Option<String>,
    cpu_cores: usize,
    memory_total_bytes: Option<u64>,
    memory_used_bytes: Option<u64>,
    process_memory_bytes: Option<u64>,
    kernel: Option<String>,
    arch: &'static str,
    in_docker: bool,
    started_at: DateTime<Utc>,
    postgres_version: Option<String>,
    database_size_bytes: Option<i64>,
    redis_version: Option<String>,
    redis_memory_bytes: Option<u64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Counts {
    users: i64,
    services: i64,
    groups: i64,
    incidents: i64,
    ongoing_incidents: i64,
    maintenance: i64,
    checks_stored: i64,
    activity_entries: i64,
}

#[derive(Serialize)]
pub struct Health {
    migrations_applied: i64,
    migrations_total: usize,
    database_ms: Option<f64>,
    redis_ms: Option<f64>,
    last_check_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct HistoryEntry {
    version: String,
    published_at: Option<DateTime<Utc>>,
    installed_at: Option<DateTime<Utc>>,
    url: Option<String>,
}

#[derive(Serialize)]
pub struct SystemInfo {
    overview: Overview,
    counts: Counts,
    health: Health,
    history: Vec<HistoryEntry>,
}

/// Reads one "key:value" line from Redis INFO output.
fn info_value<'a>(info: &'a str, key: &str) -> Option<&'a str> {
    info.lines()
        .find_map(|line| line.strip_prefix(key).and_then(|rest| rest.strip_prefix(':')))
        .map(|value| value.trim())
}

async fn redis_info(state: &AppState) -> (Option<String>, Option<u64>, Option<f64>) {
    let started = Instant::now();
    let Ok(mut conn) = state.redis.get().await else {
        return (None, None, None);
    };
    let info: Result<String, _> = deadpool_redis::redis::cmd("INFO").query_async(&mut conn).await;
    let elapsed = started.elapsed().as_secs_f64() * 1000.0;
    match info {
        Ok(info) => (
            info_value(&info, "redis_version").map(str::to_string),
            info_value(&info, "used_memory").and_then(|value| value.parse().ok()),
            Some(elapsed),
        ),
        Err(_) => (None, None, None),
    }
}

/// Everything on the System page in one request. Admin only.
pub async fn get(State(state): State<AppState>, user: CurrentUser) -> Result<Json<SystemInfo>, ApiError> {
    user.require("system.view")?;
    let machine = system_info::machine();

    let started = Instant::now();
    let postgres: Option<(String, i64)> =
        sqlx::query_as("SELECT current_setting('server_version'), pg_database_size(current_database())")
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();
    let database_ms = postgres.as_ref().map(|_| started.elapsed().as_secs_f64() * 1000.0);

    let (redis_version, redis_memory_bytes, redis_ms) = redis_info(&state).await;

    let counts: Counts = sqlx::query_as(
        r#"
        SELECT
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM services) AS services,
            (SELECT COUNT(*) FROM groups) AS groups,
            (SELECT COUNT(*) FROM incidents) AS incidents,
            (SELECT COUNT(*) FROM incidents WHERE status <> 'resolved') AS ongoing_incidents,
            (SELECT COUNT(*) FROM maintenance) AS maintenance,
            (SELECT COUNT(*) FROM metrics) AS checks_stored,
            (SELECT COUNT(*) FROM activity_log) AS activity_entries
        "#,
    )
    .fetch_one(&state.db)
    .await?;

    let (migrations_applied,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM _sqlx_migrations WHERE success")
        .fetch_one(&state.db)
        .await?;
    let (last_check_at,): (Option<DateTime<Utc>>,) = sqlx::query_as("SELECT MAX(checked_at) FROM metrics")
        .fetch_one(&state.db)
        .await?;

    let installed: Vec<(String, DateTime<Utc>)> =
        sqlx::query_as("SELECT version, first_seen_at FROM version_history ORDER BY first_seen_at DESC")
            .fetch_all(&state.db)
            .await?;
    let releases = state.update_state.read().await.releases.clone();

    // Every release from GitHub, plus versions this install ran that GitHub
    // doesn't list (for example a development build).
    let mut history: Vec<HistoryEntry> = releases
        .iter()
        .map(|release| HistoryEntry {
            version: release.version.clone(),
            published_at: release.published_at,
            installed_at: installed
                .iter()
                .find(|(version, _)| *version == release.version)
                .map(|(_, at)| *at),
            url: Some(release.url.clone()),
        })
        .collect();
    for (version, at) in &installed {
        if !history.iter().any(|entry| entry.version == *version) {
            history.push(HistoryEntry {
                version: version.clone(),
                published_at: None,
                installed_at: Some(*at),
                url: None,
            });
        }
    }

    history.sort_by(|a, b| {
        if is_newer(&a.version, &b.version) {
            std::cmp::Ordering::Less
        } else if is_newer(&b.version, &a.version) {
            std::cmp::Ordering::Greater
        } else {
            std::cmp::Ordering::Equal
        }
    });

    Ok(Json(SystemInfo {
        overview: Overview {
            version: CURRENT_VERSION,
            cpu: machine.cpu,
            cpu_cores: machine.cpu_cores,
            memory_total_bytes: machine.memory_total_bytes,
            memory_used_bytes: machine.memory_used_bytes,
            process_memory_bytes: machine.process_memory_bytes,
            kernel: machine.kernel,
            arch: machine.arch,
            in_docker: machine.in_docker,
            started_at: state.started_at,
            postgres_version: postgres.as_ref().map(|(version, _)| version.clone()),
            database_size_bytes: postgres.map(|(_, size)| size),
            redis_version,
            redis_memory_bytes,
        },
        counts,
        health: Health {
            migrations_applied,
            migrations_total: MIGRATOR.iter().count(),
            database_ms,
            redis_ms,
            last_check_at,
        },
        history,
    }))
}
