use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::services::update_checker::{self, is_newer, CURRENT_VERSION};
use crate::state::AppState;

#[derive(Serialize)]
pub struct VersionInfo {
    current: &'static str,
    latest: Option<String>,
    update_available: bool,
    release_url: Option<String>,
    update_check: bool,
    checked_at: Option<DateTime<Utc>>,
    check_error: Option<String>,
}

async fn info(state: &AppState) -> VersionInfo {
    let update = state.update_state.read().await.clone();
    let update_available = update
        .latest
        .as_ref()
        .map(|release| is_newer(&release.version, CURRENT_VERSION))
        .unwrap_or(false);

    VersionInfo {
        current: CURRENT_VERSION,
        latest: update.latest.as_ref().map(|release| release.version.clone()),
        update_available,
        release_url: update.latest.map(|release| release.url),
        update_check: state.update_check,
        checked_at: update.checked_at,
        check_error: update.error,
    }
}

pub async fn get(State(state): State<AppState>, _user: CurrentUser) -> Json<VersionInfo> {
    Json(info(&state).await)
}

/// The "Check for updates" button. Works even with UPDATE_CHECK=false, since
/// an admin clicking it is asking for exactly this one request.
pub async fn check(State(state): State<AppState>, user: CurrentUser) -> Result<Json<VersionInfo>, ApiError> {
    user.require("system.view")?;
    update_checker::check_now(&state.update_state).await;
    Ok(Json(info(&state).await))
}
