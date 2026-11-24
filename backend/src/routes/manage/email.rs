use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::activity;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::mailer;
use crate::notifications::{self, ADMIN_EVENT_KINDS, EVENT_KINDS};
use crate::state::AppState;

#[derive(Serialize)]
pub struct EmailView {
    configured: bool,
    host: Option<String>,
    port: Option<u16>,
    encryption: Option<&'static str>,
    username: Option<String>,
    /// Only whether it is set. The password itself never leaves the server.
    password_set: bool,
    from_address: Option<String>,
    from_name: Option<String>,
    recipients: i64,
}

#[derive(Deserialize)]
pub struct TestBody {
    to: String,
}

/// The SMTP settings from the environment, for admins only.
pub async fn get(State(state): State<AppState>, user: CurrentUser) -> Result<Json<EmailView>, ApiError> {
    user.require("system.email")?;
    let (recipients,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM users WHERE email IS NOT NULL AND cardinality(email_events) > 0")
            .fetch_one(&state.db)
            .await?;
    let view = match mailer::config() {
        Some(config) => EmailView {
            configured: true,
            host: Some(config.host.clone()),
            port: Some(config.port),
            encryption: Some(config.encryption.label()),
            username: config.username.clone(),
            password_set: config.password_set(),
            from_address: Some(config.from_address.to_string()),
            from_name: config.from_name.clone(),
            recipients,
        },
        None => EmailView {
            configured: false,
            host: None,
            port: None,
            encryption: None,
            username: None,
            password_set: false,
            from_address: None,
            from_name: None,
            recipients,
        },
    };
    Ok(Json(view))
}

/// Sends a sample email right away and returns the mail server's error if it fails.
pub async fn test(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<TestBody>,
) -> Result<StatusCode, ApiError> {
    user.require("system.email")?;
    if mailer::config().is_none() {
        return Err(ApiError::BadRequest("Email is not set up. Add the SMTP settings to .env first".into()));
    }
    let to = body.to.trim().to_string();
    if !mailer::is_valid_address(&to) {
        return Err(ApiError::BadRequest("Enter a valid email address".into()));
    }
    let email = notifications::test_email(&state.db, to.clone()).await?;
    mailer::send(email)
        .await
        .map_err(|e| ApiError::BadRequest(format!("The mail server refused the email: {e}")))?;
    activity::record(&state.db, &user, "system", "sent a test email", None, "", Some(json!({ "to": to }))).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct MyNotifications {
    email: Option<String>,
    email_configured: bool,
    events: Vec<String>,
    /// What pops up in the panel.
    panel_events: Vec<String>,
    /// False when this user turned panel notifications off.
    panel_enabled: bool,
    /// Only the events this user is allowed to see.
    available_events: Vec<&'static str>,
}

#[derive(Deserialize)]
pub struct MyNotificationsBody {
    events: Vec<String>,
    panel_events: Option<Vec<String>>,
    panel_enabled: Option<bool>,
}

/// Keeps known kinds the user may see, once each.
fn clean_kinds(kinds: Vec<String>, allowed: &[&'static str]) -> Result<Vec<String>, ApiError> {
    let mut cleaned: Vec<String> = Vec::new();
    for kind in kinds {
        if !allowed.contains(&kind.as_str()) {
            return Err(ApiError::BadRequest(format!("Unknown notification: {kind}")));
        }
        if !cleaned.contains(&kind) {
            cleaned.push(kind);
        }
    }
    Ok(cleaned)
}

fn available(user: &CurrentUser) -> Vec<&'static str> {
    let mut kinds: Vec<&'static str> = EVENT_KINDS
        .iter()
        .copied()
        .filter(|kind| user.require(notifications::permission_for(kind)).is_ok())
        .collect();
    for kind in ADMIN_EVENT_KINDS {
        let allowed = match notifications::admin_permission(kind) {
            Some(permission) => user.has(permission),
            None => user.is_admin,
        };
        if allowed {
            kinds.push(kind);
        }
    }
    kinds
}

pub async fn my_notifications(State(state): State<AppState>, user: CurrentUser) -> Result<Json<MyNotifications>, ApiError> {
    let (events, panel_events): (Vec<String>, Vec<String>) =
        sqlx::query_as("SELECT email_events, panel_events FROM users WHERE id = $1")
            .bind(user.id)
            .fetch_one(&state.db)
            .await?;
    let allowed = available(&user);
    Ok(Json(MyNotifications {
        email: user.email.clone(),
        email_configured: mailer::config().is_some(),
        events: events.into_iter().filter(|kind| allowed.contains(&kind.as_str())).collect(),
        panel_events: panel_events.into_iter().filter(|kind| allowed.contains(&kind.as_str())).collect(),
        panel_enabled: user.panel_enabled,
        available_events: allowed,
    }))
}

pub async fn update_my_notifications(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<MyNotificationsBody>,
) -> Result<StatusCode, ApiError> {
    let allowed = available(&user);
    let events = clean_kinds(body.events, &allowed)?;
    sqlx::query("UPDATE users SET email_events = $1 WHERE id = $2")
        .bind(&events)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    let mut panel_events: Option<Vec<String>> = None;
    if let Some(kinds) = body.panel_events {
        let kinds = clean_kinds(kinds, &allowed)?;
        // Kinds this user can't see stay as they were, so they come back on
        // when they get the permission again.
        sqlx::query(
            r#"
            UPDATE users SET panel_events = ARRAY(
                SELECT kind FROM unnest(panel_events) AS kind WHERE NOT (kind = ANY($2))
            ) || $1::text[]
            WHERE id = $3
            "#,
        )
        .bind(&kinds)
        .bind(&allowed)
        .bind(user.id)
        .execute(&state.db)
        .await?;
        panel_events = Some(kinds);
    }
    if let Some(enabled) = body.panel_enabled {
        sqlx::query("UPDATE users SET panel_enabled = $1 WHERE id = $2")
            .bind(enabled)
            .bind(user.id)
            .execute(&state.db)
            .await?;
    }
    activity::record(
        &state.db,
        &user,
        "account",
        "changed their notifications",
        None,
        "",
        Some(json!({ "events": events, "panel_events": panel_events, "panel_enabled": body.panel_enabled })),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}
