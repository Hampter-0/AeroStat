use std::collections::HashMap;

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::Json;
use chrono_tz::Tz;
use serde::Serialize;

use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::routes::settings::{asset_versions, BRAND_ASSETS};
use crate::site_settings::{self, CONTACT_URL, METRICS_RETENTION_DAYS, PRIMARY_COLOR, SITE_NAME, TIMEZONE};
use crate::state::AppState;

const PERMISSION: &str = "settings";
const MAX_ASSET_BYTES: usize = 1024 * 1024;
const ALLOWED_TYPES: [&str; 6] = [
    "image/png",
    "image/jpeg",
    "image/svg+xml",
    "image/webp",
    "image/gif",
    "image/x-icon",
];

#[derive(Serialize)]
pub struct Defaults {
    timezone: &'static str,
    metrics_retention_days: i32,
}

#[derive(Serialize)]
pub struct ManageSettings {
    values: HashMap<String, Option<String>>,
    defaults: Defaults,
    logo_version: Option<i64>,
    favicon_version: Option<i64>,
}

fn validate(key: &str, value: &str) -> Result<String, ApiError> {
    let value = value.trim();
    match key {
        SITE_NAME => {
            if value.chars().count() > 60 {
                return Err(ApiError::BadRequest("Site name can be at most 60 characters".into()));
            }
        }
        CONTACT_URL => {
            let ok = reqwest::Url::parse(value)
                .map(|url| matches!(url.scheme(), "http" | "https" | "mailto"))
                .unwrap_or(false);
            if !ok {
                return Err(ApiError::BadRequest(
                    "Contact link must be a full https:// URL or a mailto: address".into(),
                ));
            }
        }
        PRIMARY_COLOR => {
            let hex = value.strip_prefix('#').unwrap_or("");
            if hex.len() != 6 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(ApiError::BadRequest("Accent color must look like #1678c2".into()));
            }
            return Ok(value.to_lowercase());
        }
        TIMEZONE => {
            if value.parse::<Tz>().is_err() {
                return Err(ApiError::BadRequest(format!("Unknown timezone: {value}")));
            }
        }
        METRICS_RETENTION_DAYS => {
            let days: i32 = value
                .parse()
                .map_err(|_| ApiError::BadRequest("Retention must be a whole number of days".into()))?;
            if !(7..=3650).contains(&days) {
                return Err(ApiError::BadRequest("Retention must be between 7 and 3650 days".into()));
            }
        }
        _ => return Err(ApiError::BadRequest(format!("Unknown setting: {key}"))),
    }
    Ok(value.to_string())
}

pub async fn get(State(state): State<AppState>, user: CurrentUser) -> Result<Json<ManageSettings>, ApiError> {
    user.require(PERMISSION)?;
    let stored = site_settings::all(&state.db).await?;
    let mut values = HashMap::new();
    for key in site_settings::KEYS {
        values.insert(key.to_string(), stored.get(key).cloned());
    }
    let (logo_version, favicon_version) = asset_versions(&state.db).await?;

    Ok(Json(ManageSettings {
        values,
        defaults: Defaults {
            timezone: "UTC",
            metrics_retention_days: state.default_retention_days,
        },
        logo_version,
        favicon_version,
    }))
}

/// Saves the given keys. An empty value or null removes the setting, so the
/// .env value or the built-in default applies again.
pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<HashMap<String, Option<String>>>,
) -> Result<StatusCode, ApiError> {
    user.require(PERMISSION)?;

    let mut changes: Vec<(String, Option<String>)> = Vec::new();
    for (key, value) in body {
        if !site_settings::KEYS.contains(&key.as_str()) {
            return Err(ApiError::BadRequest(format!("Unknown setting: {key}")));
        }
        let cleaned = match value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) {
            Some(v) => Some(validate(&key, &v)?),
            None => None,
        };
        changes.push((key, cleaned));
    }

    let old_tz = site_settings::timezone(&state.db).await;

    let mut tx = state.db.begin().await?;
    for (key, value) in &changes {
        match value {
            Some(v) => {
                sqlx::query(
                    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
                )
                .bind(key)
                .bind(v)
                .execute(&mut *tx)
                .await?;
            }
            None => {
                sqlx::query("DELETE FROM settings WHERE key = $1")
                    .bind(key)
                    .execute(&mut *tx)
                    .await?;
            }
        }
    }
    tx.commit().await?;

    // Day bars are per local day, so a new timezone means recomputing them.
    if site_settings::timezone(&state.db).await != old_tz {
        let db = state.db.clone();
        let redis = state.redis.clone();
        tokio::spawn(async move {
            if let Err(e) = crate::db::backfill(&db, &redis).await {
                tracing::error!("Backfill after timezone change failed: {e}");
            }
        });
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn upload_asset(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(name): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    user.require(PERMISSION)?;
    if !BRAND_ASSETS.contains(&name.as_str()) {
        return Err(ApiError::NotFound);
    }

    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or("").trim().to_lowercase())
        .unwrap_or_default();
    let content_type = if content_type == "image/vnd.microsoft.icon" {
        "image/x-icon".to_string()
    } else {
        content_type
    };
    if !ALLOWED_TYPES.contains(&content_type.as_str()) {
        return Err(ApiError::BadRequest("Upload a PNG, JPG, SVG, WebP, GIF or ICO image".into()));
    }
    if body.is_empty() {
        return Err(ApiError::BadRequest("The file is empty".into()));
    }
    if body.len() > MAX_ASSET_BYTES {
        return Err(ApiError::BadRequest("The file can be at most 1 MB".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO brand_assets (name, content_type, data) VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = now()
        "#,
    )
    .bind(&name)
    .bind(&content_type)
    .bind(body.as_ref())
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_asset(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(name): Path<String>,
) -> Result<StatusCode, ApiError> {
    user.require(PERMISSION)?;
    if !BRAND_ASSETS.contains(&name.as_str()) {
        return Err(ApiError::NotFound);
    }
    sqlx::query("DELETE FROM brand_assets WHERE name = $1")
        .bind(&name)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
