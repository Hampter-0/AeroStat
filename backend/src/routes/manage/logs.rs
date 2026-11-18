//! The backend's recent log lines for System → Logs. Logs can hold IP
//! addresses, usernames and email addresses, so they need their own permission.

use axum::extract::{Query, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::activity;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::log_buffer::{self, LogLine, CAPACITY};
use crate::state::AppState;

const PAGE: usize = 500;

#[derive(Deserialize)]
pub struct LogsQuery {
    /// "all", "info", "warn" or "error": that level and worse.
    level: Option<String>,
    q: Option<String>,
    /// Only lines newer than this id, for polling.
    after: Option<u64>,
}

#[derive(Serialize)]
pub struct LogsResponse {
    /// Newest first, at most 500.
    lines: Vec<LogLine>,
    /// How many lines matched in total.
    matched: usize,
    capacity: usize,
}

fn rank(level: &str) -> u8 {
    match level {
        "error" => 4,
        "warn" => 3,
        "info" => 2,
        _ => 1,
    }
}

fn filtered(query: &LogsQuery) -> Result<Vec<LogLine>, ApiError> {
    let level = query.level.clone().unwrap_or_else(|| "all".to_string());
    if !["all", "info", "warn", "error"].contains(&level.as_str()) {
        return Err(ApiError::BadRequest(format!("Unknown level: {level}")));
    }
    let minimum = if level == "all" { 0 } else { rank(&level) };
    let needle = query
        .q
        .as_deref()
        .map(|text| text.trim().to_lowercase())
        .filter(|text| !text.is_empty());

    let mut lines: Vec<LogLine> = log_buffer::lines()
        .into_iter()
        .filter(|line| rank(line.level) >= minimum)
        .filter(|line| query.after.map(|after| line.id > after).unwrap_or(true))
        .filter(|line| match &needle {
            Some(needle) => {
                line.message.to_lowercase().contains(needle) || line.target.to_lowercase().contains(needle)
            }
            None => true,
        })
        .collect();
    lines.reverse();
    Ok(lines)
}

pub async fn list(user: CurrentUser, Query(query): Query<LogsQuery>) -> Result<Json<LogsResponse>, ApiError> {
    user.require("system.logs")?;
    let mut lines = filtered(&query)?;
    let matched = lines.len();
    lines.truncate(PAGE);
    Ok(Json(LogsResponse {
        lines,
        matched,
        capacity: CAPACITY,
    }))
}

/// Everything that matches as plain text, oldest first, like a log file.
pub async fn download(user: CurrentUser, Query(query): Query<LogsQuery>) -> Result<impl IntoResponse, ApiError> {
    user.require("system.logs")?;
    let mut lines = filtered(&query)?;
    lines.reverse();
    let mut text = String::new();
    for line in lines {
        text.push_str(&format!(
            "{} {:>5} {}: {}\n",
            line.time.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            line.level.to_uppercase(),
            line.target,
            line.message
        ));
    }
    let name = format!("aerostat-logs-{}.txt", chrono::Utc::now().format("%Y%m%d-%H%M%S"));
    Ok((
        [
            (header::CONTENT_TYPE, "text/plain; charset=utf-8".to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{name}\"")),
        ],
        text,
    ))
}

/// Empties the list in the panel. The terminal and `docker logs` keep
/// everything. Written to the activity log and as the first new line, so
/// clearing never goes unnoticed.
pub async fn clear(State(state): State<AppState>, user: CurrentUser) -> Result<StatusCode, ApiError> {
    user.require("system.logs")?;
    log_buffer::clear();
    tracing::info!("Logs cleared in the panel by {}", user.username);
    activity::record(&state.db, &user, "system", "cleared the logs", None, "", None).await;
    Ok(StatusCode::NO_CONTENT)
}
