use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use sqlx::PgPool;

use crate::error::ApiError;
use crate::site_settings;
use crate::state::AppState;

pub const BRAND_ASSETS: [&str; 2] = ["logo", "favicon"];

#[derive(Serialize)]
pub struct PublicSettings {
    site_name: Option<String>,
    site_description: Option<String>,
    contact_url: Option<String>,
    company_name: Option<String>,
    company_url: Option<String>,
    primary_color: Option<String>,
    timezone: String,
    logo_version: Option<i64>,
    favicon_version: Option<i64>,
}

/// Version per uploaded asset (its update time), so the frontend can bust caches.
pub async fn asset_versions(db: &PgPool) -> Result<(Option<i64>, Option<i64>), ApiError> {
    let rows: Vec<(String, i64)> =
        sqlx::query_as("SELECT name, EXTRACT(EPOCH FROM updated_at)::bigint FROM brand_assets")
            .fetch_all(db)
            .await?;
    let mut logo = None;
    let mut favicon = None;
    for (name, version) in rows {
        if name == "logo" {
            logo = Some(version);
        } else if name == "favicon" {
            favicon = Some(version);
        }
    }
    Ok((logo, favicon))
}

pub async fn get(State(state): State<AppState>) -> Result<Json<PublicSettings>, ApiError> {
    let mut values = site_settings::all(&state.db).await?;
    let tz = site_settings::timezone(&state.db).await;
    let (logo_version, favicon_version) = asset_versions(&state.db).await?;

    Ok(Json(PublicSettings {
        site_name: values.remove(site_settings::SITE_NAME),
        site_description: values.remove(site_settings::SITE_DESCRIPTION),
        contact_url: values.remove(site_settings::CONTACT_URL),
        company_name: values.remove(site_settings::COMPANY_NAME),
        company_url: values.remove(site_settings::COMPANY_URL),
        primary_color: values.remove(site_settings::PRIMARY_COLOR),
        timezone: tz.name().to_string(),
        logo_version,
        favicon_version,
    }))
}

pub async fn brand_asset(State(state): State<AppState>, Path(name): Path<String>) -> Result<Response, ApiError> {
    if !BRAND_ASSETS.contains(&name.as_str()) {
        return Err(ApiError::NotFound);
    }
    let row: Option<(String, Vec<u8>)> =
        sqlx::query_as("SELECT content_type, data FROM brand_assets WHERE name = $1")
            .bind(&name)
            .fetch_optional(&state.db)
            .await?;
    let (content_type, data) = row.ok_or(ApiError::NotFound)?;

    // Uploaded SVGs could contain scripts; the sandbox CSP keeps them inert
    // even when the file is opened directly.
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, content_type),
            (header::CACHE_CONTROL, "public, max-age=300".to_string()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_string()),
            (
                header::CONTENT_SECURITY_POLICY,
                "default-src 'none'; style-src 'unsafe-inline'; sandbox".to_string(),
            ),
        ],
        Body::from(data),
    )
        .into_response())
}
