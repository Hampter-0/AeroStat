use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::activity;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::mailer;
use crate::notifications::{self, EVENT_KINDS};
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
    user.require_admin()?;
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
    user.require_admin()?;
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
    activity::record(&state.db, &user, "settings", "sent a test email", None, "", Some(json!({ "to": to }))).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct MyNotifications {
    email: Option<String>,
    email_configured: bool,
    events: Vec<String>,
    /// Only the events this user is allowed to see.
    available_events: Vec<&'static str>,
}

#[derive(Deserialize)]
pub struct MyNotificationsBody {
    events: Vec<String>,
}

fn available(user: &CurrentUser) -> Vec<&'static str> {
    EVENT_KINDS
        .iter()
        .copied()
        .filter(|kind| user.require(notifications::permission_for(kind)).is_ok())
        .collect()
}

pub async fn my_notifications(State(state): State<AppState>, user: CurrentUser) -> Result<Json<MyNotifications>, ApiError> {
    let (events,): (Vec<String>,) = sqlx::query_as("SELECT email_events FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    let allowed = available(&user);
    Ok(Json(MyNotifications {
        email: user.email.clone(),
        email_configured: mailer::config().is_some(),
        events: events.into_iter().filter(|kind| allowed.contains(&kind.as_str())).collect(),
        available_events: allowed,
    }))
}

pub async fn update_my_notifications(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<MyNotificationsBody>,
) -> Result<StatusCode, ApiError> {
    let allowed = available(&user);
    let mut events: Vec<String> = Vec::new();
    for kind in body.events {
        if !allowed.contains(&kind.as_str()) {
            return Err(ApiError::BadRequest(format!("Unknown notification: {kind}")));
        }
        if !events.contains(&kind) {
            events.push(kind);
        }
    }
    sqlx::query("UPDATE users SET email_events = $1 WHERE id = $2")
        .bind(&events)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    activity::record(
        &state.db,
        &user,
        "account",
        "changed their email notifications",
        None,
        "",
        Some(json!({ "events": events })),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}
