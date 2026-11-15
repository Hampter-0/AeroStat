use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::auth::CurrentUser;
use crate::services::update_checker::{is_newer, CURRENT_VERSION};
use crate::state::AppState;

#[derive(Serialize)]
pub struct VersionInfo {
    current: &'static str,
    latest: Option<String>,
    update_available: bool,
    release_url: Option<String>,
    update_check: bool,
}

pub async fn get(State(state): State<AppState>, _user: CurrentUser) -> Json<VersionInfo> {
    let latest = state.latest_release.read().await.clone();
    let update_available = latest
        .as_ref()
        .map(|release| is_newer(&release.version, CURRENT_VERSION))
        .unwrap_or(false);

    Json(VersionInfo {
        current: CURRENT_VERSION,
        latest: latest.as_ref().map(|release| release.version.clone()),
        update_available,
        release_url: latest.map(|release| release.url),
        update_check: state.update_check,
    })
}
