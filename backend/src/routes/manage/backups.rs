use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::Response;
use axum::Json;
use serde::Serialize;
use serde_json::json;
use tokio_util::io::ReaderStream;

use crate::activity;
use crate::auth::CurrentUser;
use crate::backups::{self, Backup, Kind};
use crate::error::ApiError;
use crate::services::update_checker::CURRENT_VERSION;
use crate::site_settings;
use crate::state::AppState;

const PERMISSION: &str = "system.backups";

#[derive(Serialize)]
pub struct BackupSettings {
    schedule: String,
    keep: i64,
    before_update: bool,
}

#[derive(Serialize)]
pub struct BackupsView {
    backups: Vec<Backup>,
    /// The pg_dump version, or None when pg_dump can't run here.
    tool: Option<String>,
    dir: Option<String>,
    total_bytes: u64,
    settings: BackupSettings,
    version: &'static str,
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<BackupsView>, ApiError> {
    user.require(PERMISSION)?;
    let backups = backups::list().await.map_err(|e| ApiError::BadRequest(format!("{e:#}")))?;
    let total_bytes = backups.iter().map(|backup| backup.size_bytes).sum();
    Ok(Json(BackupsView {
        backups,
        tool: backups::tool_version().await,
        dir: backups::dir(),
        total_bytes,
        settings: BackupSettings {
            schedule: site_settings::backup_schedule(&state.db).await,
            keep: site_settings::backup_keep(&state.db).await,
            before_update: site_settings::backup_before_update(&state.db).await,
        },
        version: CURRENT_VERSION,
    }))
}

pub async fn create(State(state): State<AppState>, user: CurrentUser) -> Result<Json<Backup>, ApiError> {
    user.require(PERMISSION)?;
    let backup = backups::create(Kind::Manual, Some(user.username.clone()), CURRENT_VERSION, None)
        .await
        .map_err(|e| ApiError::BadRequest(format!("{e:#}")))?;
    activity::record(
        &state.db,
        &user,
        "system",
        "made a backup",
        Some(backup.id.clone()),
        &backup.id,
        Some(json!({ "size_bytes": backup.size_bytes })),
    )
    .await;
    Ok(Json(backup))
}

pub async fn delete(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> Result<StatusCode, ApiError> {
    user.require(PERMISSION)?;
    let backup = backups::find(&id)
        .await
        .map_err(|e| ApiError::BadRequest(format!("{e:#}")))?
        .ok_or(ApiError::NotFound)?;
    backups::delete(&backup.id).await.map_err(|e| ApiError::BadRequest(format!("{e:#}")))?;
    activity::record(&state.db, &user, "system", "deleted a backup", Some(backup.id.clone()), &backup.id, None).await;
    Ok(StatusCode::NO_CONTENT)
}

/// Streams the dump file, so large backups don't have to fit in memory.
pub async fn download(State(state): State<AppState>, user: CurrentUser, Path(id): Path<String>) -> Result<Response, ApiError> {
    user.require(PERMISSION)?;
    let backup = backups::find(&id)
        .await
        .map_err(|e| ApiError::BadRequest(format!("{e:#}")))?
        .ok_or(ApiError::NotFound)?;
    let path = backups::file_path(&backup.id).map_err(|_| ApiError::NotFound)?;
    let file = tokio::fs::File::open(&path).await.map_err(|_| ApiError::NotFound)?;

    activity::record(&state.db, &user, "system", "downloaded a backup", Some(backup.id.clone()), &backup.id, None).await;

    Response::builder()
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, backup.size_bytes)
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}.dump\"", backup.id))
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from_stream(ReaderStream::new(file)))
        .map_err(|e| ApiError::BadRequest(format!("Could not send the backup: {e}")))
}

/// Adds an uploaded dump to the list, for example one from another server.
/// Putting it back is done with the CLI, like any other backup.
pub async fn upload(State(state): State<AppState>, user: CurrentUser, headers: HeaderMap, body: Body) -> Result<Json<Backup>, ApiError> {
    user.require(PERMISSION)?;
    let file_name = headers
        .get("x-file-name")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim().to_string());
    let backup = backups::import(body.into_data_stream(), user.username.clone(), file_name)
        .await
        .map_err(|e| ApiError::BadRequest(format!("{e:#}")))?;
    activity::record(
        &state.db,
        &user,
        "system",
        "uploaded a backup",
        Some(backup.id.clone()),
        &backup.id,
        Some(json!({ "size_bytes": backup.size_bytes, "version": backup.version })),
    )
    .await;
    Ok(Json(backup))
}
