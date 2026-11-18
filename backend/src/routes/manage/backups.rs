use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::Response;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio_util::io::ReaderStream;

use crate::activity;
use crate::login_guard;
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
    /// In Docker the folder is inside the container, so the page explains how to reach it.
    in_docker: bool,
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
        in_docker: std::path::Path::new("/.dockerenv").exists(),
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
    // A dump runs as SQL when it is restored, so only admins may add one.
    if !user.is_admin {
        return Err(ApiError::BadRequest("Only an admin can upload a backup".into()));
    }
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

#[derive(Deserialize)]
pub struct RestoreBody {
    password: String,
}

#[derive(Serialize)]
pub struct RestoreResult {
    /// True when AeroStat restarts itself now (in Docker); otherwise the
    /// backend has to be restarted by hand.
    restarting: bool,
    safety_backup: String,
}

/// Puts a backup back from the panel, for admins only and after the
/// current password. The database as it is now is backed up first. In Docker
/// the backend then restarts, so newer migrations run and nothing old stays in
/// memory.
pub async fn restore(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    Json(body): Json<RestoreBody>,
) -> Result<Json<RestoreResult>, ApiError> {
    user.require(PERMISSION)?;
    if !user.is_admin {
        return Err(ApiError::BadRequest("Only an admin can restore a backup".into()));
    }
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    login_guard::verify_current_password(&state.redis, &state.login_limits, user.id, body.password, hash).await?;

    let backup = backups::find(&id)
        .await
        .map_err(|e| ApiError::BadRequest(format!("{e:#}")))?
        .ok_or(ApiError::NotFound)?;
    if backups::is_newer(&backup.version, CURRENT_VERSION) {
        return Err(ApiError::BadRequest(format!(
            "This backup is from v{}, newer than this AeroStat (v{CURRENT_VERSION}). Update AeroStat first",
            backup.version
        )));
    }

    let safety = backups::create(
        Kind::Restore,
        Some(user.username.clone()),
        CURRENT_VERSION,
        Some(format!("Before restoring {}", backup.id)),
    )
    .await
    .map_err(|e| ApiError::BadRequest(format!("Could not back up the current database, so nothing was restored: {e:#}")))?;

    backups::restore(&backup.id)
        .await
        .map_err(|e| ApiError::BadRequest(format!("{e:#}")))?;
    tracing::info!("{} restored backup {} from the panel", user.username, backup.id);

    // Written after the restore, so it lands in the database that is now in use.
    // The account may not exist in the restored data, so the link is kept only if it does.
    let logged = sqlx::query(
        r#"
        INSERT INTO activity_log (user_id, username, category, action, target_id, target_label, details, ip)
        VALUES ((SELECT id FROM users WHERE id = $1), $2, 'system', 'restored a backup', $3, $3, $4::jsonb, $5)
        "#,
    )
    .bind(user.id)
    .bind(&user.username)
    .bind(&backup.id)
    .bind(json!({ "safety_backup": safety.id, "version": backup.version }).to_string())
    .bind(&user.ip)
    .execute(&state.db)
    .await;
    if let Err(e) = logged {
        tracing::warn!("Could not log the restore: {e}");
    }
    let title = format!("{} restored the backup from {}", user.username, backup.created_at.format("%-d %b %Y, %H:%M UTC"));
    super::users::admin_notice(&state.db, &user, "admin_security", title, "/manage/system?tab=backups");

    let restarting = std::path::Path::new("/.dockerenv").exists();
    if restarting {
        tokio::spawn(async {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            tracing::info!("Restarting after a restore");
            std::process::exit(0);
        });
    }
    Ok(Json(RestoreResult {
        restarting,
        safety_backup: safety.id,
    }))
}
