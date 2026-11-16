use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::activity;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::notifications::{self, EVENT_KINDS};
use crate::state::AppState;

const PERMISSION: &str = "settings";

#[derive(Serialize)]
pub struct NotificationView {
    /// Never the full URL: it works as a password for posting to the channel.
    discord_configured: bool,
    discord_hint: Option<String>,
    public_url: Option<String>,
    events: Vec<String>,
    available_events: Vec<&'static str>,
}

#[derive(Deserialize)]
pub struct NotificationBody {
    /// Missing keeps the current webhook, an empty string removes it.
    discord_webhook_url: Option<String>,
    public_url: Option<String>,
    events: Vec<String>,
}

fn hint(url: &str) -> String {
    let tail: String = url.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
    format!("…{tail}")
}

pub async fn get(State(state): State<AppState>, user: CurrentUser) -> Result<Json<NotificationView>, ApiError> {
    user.require("settings.notifications")?;
    let settings = notifications::load(&state.db).await?;
    Ok(Json(NotificationView {
        discord_configured: settings.discord_webhook_url.is_some(),
        discord_hint: settings.discord_webhook_url.as_deref().map(hint),
        public_url: settings.public_url,
        events: settings.events,
        available_events: EVENT_KINDS.to_vec(),
    }))
}

fn clean_public_url(value: Option<String>) -> Result<Option<String>, ApiError> {
    let Some(value) = value.map(|v| v.trim().trim_end_matches('/').to_string()).filter(|v| !v.is_empty()) else {
        return Ok(None);
    };
    let ok = reqwest::Url::parse(&value)
        .map(|url| matches!(url.scheme(), "http" | "https") && url.host_str().is_some())
        .unwrap_or(false);
    if !ok {
        return Err(ApiError::BadRequest("Status page address must start with https://".into()));
    }
    Ok(Some(value))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<NotificationBody>,
) -> Result<StatusCode, ApiError> {
    user.require("settings.notifications")?;
    for kind in &body.events {
        if !EVENT_KINDS.contains(&kind.as_str()) {
            return Err(ApiError::BadRequest(format!("Unknown notification: {kind}")));
        }
    }
    let public_url = clean_public_url(body.public_url)?;

    let webhook_change = match body.discord_webhook_url.map(|url| url.trim().to_string()) {
        None => None,
        Some(url) if url.is_empty() => Some(None),
        Some(url) => {
            if !notifications::is_discord_webhook(&url) {
                return Err(ApiError::BadRequest(
                    "Paste a Discord webhook URL, it starts with https://discord.com/api/webhooks/".into(),
                ));
            }
            Some(Some(url))
        }
    };

    let mut tx = state.db.begin().await?;
    sqlx::query("UPDATE notification_settings SET public_url = $1, events = $2, updated_at = now()")
        .bind(&public_url)
        .bind(&body.events)
        .execute(&mut *tx)
        .await?;
    if let Some(webhook) = &webhook_change {
        sqlx::query("UPDATE notification_settings SET discord_webhook_url = $1")
            .bind(webhook)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;

    let webhook_text = match &webhook_change {
        None => "unchanged",
        Some(None) => "removed",
        Some(Some(_)) => "changed",
    };
    let details = json!({ "events": body.events, "public_url": public_url, "discord_webhook": webhook_text });
    activity::record(&state.db, &user, PERMISSION, "changed", None, "notifications", Some(details)).await;
    Ok(StatusCode::NO_CONTENT)
}

/// Sends a sample message right away, so a wrong webhook shows up as an error.
pub async fn test(State(state): State<AppState>, user: CurrentUser) -> Result<StatusCode, ApiError> {
    user.require("settings.notifications")?;
    let settings = notifications::load(&state.db).await?;
    let Some(webhook) = settings.discord_webhook_url.clone() else {
        return Err(ApiError::BadRequest("Save a Discord webhook first".into()));
    };
    let payload = notifications::test_payload(&state.db, &settings).await;
    notifications::send_discord(&webhook, &payload)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Discord refused the message: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}
