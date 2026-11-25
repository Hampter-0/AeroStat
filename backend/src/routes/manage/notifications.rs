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
    /// Set under Settings → General; shown so the page can say where links go.
    public_url: Option<String>,
    events: Vec<String>,
    available_events: Vec<&'static str>,
}

#[derive(Deserialize)]
pub struct NotificationBody {
    /// Missing keeps the current webhook, an empty string removes it.
    discord_webhook_url: Option<String>,
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
    sqlx::query("UPDATE notification_settings SET events = $1, updated_at = now()")
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
    let details = json!({ "events": body.events, "discord_webhook": webhook_text });
    activity::record(&state.db, &user, PERMISSION, "changed", None, "notifications", Some(details)).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct TestSent {
    sent: Vec<&'static str>,
}

/// A sample "slower than usual" message for the first service, so you see
/// how it looks on Discord, by email and in the panel.
pub async fn test_slow(State(state): State<AppState>, user: CurrentUser) -> Result<Json<TestSent>, ApiError> {
    user.require("settings.notifications")?;
    let service: Option<(String, Option<f64>)> = sqlx::query_as(
        r#"
        SELECT s.id, (
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY response_time)::float8 FROM metrics
            WHERE service_id = s.id AND status = 'online' AND checked_at >= now() - interval '7 days'
        )
        FROM services s LEFT JOIN groups g ON g.id = s.group_id
        ORDER BY g.sort_order, s.sort_order LIMIT 1
        "#,
    )
    .fetch_optional(&state.db)
    .await?;
    let Some((id, usual)) = service else {
        return Err(ApiError::BadRequest("Add a service first".into()));
    };
    let usual = usual.map(|ms| ms.round() as i32).unwrap_or(120).max(1);
    let event = notifications::Event::ResponseSlow {
        services: vec![notifications::SlowService {
            id,
            ms: usual * 3 + 100,
            usual_ms: Some(usual),
            limit_ms: None,
        }],
    };
    let sent = notifications::send_test_event(&state.db, user.id, user.email.clone(), &event)
        .await
        .map_err(|e| ApiError::BadRequest(format!("The test could not be sent: {e}")))?;
    Ok(Json(TestSent { sent }))
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
