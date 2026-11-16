use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use deadpool_redis::redis::AsyncCommands;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::PgPool;

use crate::activity;
use crate::auth;
use crate::error::ApiError;
use crate::login_guard;
use crate::mailer;
use crate::site_settings;
use crate::state::AppState;

use super::users::validate_password;

/// How long a reset link works.
const LINK_MINUTES: i64 = 30;
/// Requests from one IP before it has to wait.
const MAX_REQUESTS_PER_IP: i64 = 5;
const REQUEST_WINDOW_SECONDS: i64 = 15 * 60;
/// One email per account per minute, so nobody can flood an inbox.
const EMAIL_COOLDOWN_SECONDS: u64 = 60;

#[derive(Deserialize)]
pub struct RequestBody {
    email: String,
}

#[derive(Deserialize)]
pub struct TokenQuery {
    token: String,
}

#[derive(Serialize)]
pub struct TokenCheck {
    valid: bool,
}

#[derive(Deserialize)]
pub struct ConfirmBody {
    token: String,
    password: String,
}

/// Reset by email needs a mail server and the status page address for the link.
/// The address never comes from the request, or someone could make the email
/// point to their own site.
pub async fn available(db: &PgPool) -> bool {
    mailer::config().is_some() && site_settings::public_url(db).await.is_some()
}

fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.trim().as_bytes()))
}

fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Counts requests per IP. Over the limit the request is refused; if Redis is
/// down, requests keep working.
async fn check_ip_limit(state: &AppState, ip: &str) -> Result<(), ApiError> {
    let key = format!("reset:ip:{ip}");
    let count: anyhow::Result<i64> = async {
        let mut conn = state.redis.get().await?;
        let count: i64 = conn.incr(&key, 1).await?;
        if count == 1 {
            conn.expire::<_, ()>(&key, REQUEST_WINDOW_SECONDS).await?;
        }
        Ok(count)
    }
    .await;
    match count {
        Ok(count) if count > MAX_REQUESTS_PER_IP => Err(ApiError::TooManyRequests(
            "Too many reset requests. Try again in 15 minutes.".into(),
        )),
        Ok(_) => Ok(()),
        Err(e) => {
            tracing::warn!("Could not count a reset request: {e}");
            Ok(())
        }
    }
}

/// True the first time in a minute for this account.
async fn may_email(state: &AppState, user_id: i64) -> bool {
    let key = format!("reset:user:{user_id}");
    let result: anyhow::Result<bool> = async {
        let mut conn = state.redis.get().await?;
        let set: Option<String> = deadpool_redis::redis::cmd("SET")
            .arg(&key)
            .arg("1")
            .arg("NX")
            .arg("EX")
            .arg(EMAIL_COOLDOWN_SECONDS)
            .query_async(&mut conn)
            .await?;
        Ok(set.is_some())
    }
    .await;
    result.unwrap_or(true)
}

async fn site_name(db: &PgPool) -> String {
    site_settings::all(db)
        .await
        .ok()
        .and_then(|mut values| values.remove(site_settings::SITE_NAME))
        .unwrap_or_else(|| "AeroStat".to_string())
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

async fn send_link(db: &PgPool, to: &str, username: &str, link: &str) -> anyhow::Result<()> {
    let site = site_name(db).await;
    let text = format!(
        "Hi {username},\n\nSomeone asked to reset the password of your {site} account. Choose a new one here:\n\n{link}\n\nThe link works once, for {LINK_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password stays the same."
    );
    let html = format!(
        r#"<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:480px;margin:0 auto;padding:28px 32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<p style="margin:0 0 12px;font-size:15px;color:#334155">Hi {name},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#334155">Someone asked to reset the password of your {site_html} account.</p>
<p style="margin:0 0 20px"><a href="{link_html}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">Choose a new password</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">The link works once, for {LINK_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password stays the same.</p>
</div></body></html>"#,
        name = escape(username),
        site_html = escape(&site),
        link_html = escape(link),
    );
    mailer::send(mailer::Email {
        to: to.to_string(),
        subject: format!("[{site}] Reset your password"),
        html,
        text,
        site_name: site,
    })
    .await
}

/// Sends a reset link when an account uses this address. The answer is the same
/// either way, so it can't be used to find out who has an account.
pub async fn request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RequestBody>,
) -> Result<StatusCode, ApiError> {
    let Some(base) = site_settings::public_url(&state.db).await.filter(|_| mailer::config().is_some()) else {
        return Err(ApiError::BadRequest(
            "Resetting by email is not set up. Ask an admin to reset your password.".into(),
        ));
    };
    let ip = login_guard::client_ip(&headers);
    check_ip_limit(&state, &ip).await?;

    let email = body.email.trim().to_lowercase();
    if email.is_empty() || email.len() > 254 {
        return Err(ApiError::BadRequest("Enter your email address".into()));
    }

    let user: Option<(i64, String, String)> =
        sqlx::query_as("SELECT id, username, email FROM users WHERE lower(email) = $1")
            .bind(&email)
            .fetch_optional(&state.db)
            .await?;
    let Some((user_id, username, address)) = user else {
        return Ok(StatusCode::NO_CONTENT);
    };
    if !may_email(&state, user_id).await {
        return Ok(StatusCode::NO_CONTENT);
    }

    let token = new_token();
    let mut tx = state.db.begin().await?;
    // Only the newest link works.
    sqlx::query("DELETE FROM password_resets WHERE user_id = $1 OR expires_at < now() - interval '1 day'")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO password_resets (user_id, token_hash, ip, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))",
    )
    .bind(user_id)
    .bind(hash_token(&token))
    .bind(&ip)
    .bind(LINK_MINUTES as i32)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    activity::record_account(&state.db, Some(user_id), &username, "asked for a password reset", &ip, None).await;

    // Sent in the background, so the answer takes as long for unknown addresses.
    let db = state.db.clone();
    let link = format!("{base}/manage/reset-password?token={token}");
    tokio::spawn(async move {
        if let Err(e) = send_link(&db, &address, &username, &link).await {
            tracing::warn!("Could not send a password reset email: {e:#}");
        }
    });

    Ok(StatusCode::NO_CONTENT)
}

/// Whether a link still works, so the page can say so before someone types a password.
pub async fn check(State(state): State<AppState>, Query(query): Query<TokenQuery>) -> Result<Json<TokenCheck>, ApiError> {
    let valid: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now())",
    )
    .bind(hash_token(&query.token))
    .fetch_one(&state.db)
    .await?;
    Ok(Json(TokenCheck { valid }))
}

/// Sets the new password and signs the account out everywhere.
pub async fn confirm(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ConfirmBody>,
) -> Result<StatusCode, ApiError> {
    let ip = login_guard::client_ip(&headers);
    let limits = state.login_limits;
    login_guard::check(&state.redis, &limits, &ip, None).await?;
    validate_password(&body.password)?;

    let row: Option<(i64, i64, String)> = sqlx::query_as(
        r#"
        SELECT r.id, u.id, u.username FROM password_resets r
        JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now()
        "#,
    )
    .bind(hash_token(&body.token))
    .fetch_optional(&state.db)
    .await?;
    let Some((reset_id, user_id, username)) = row else {
        login_guard::record_failure(&state.redis, &limits, &ip, None).await;
        return Err(ApiError::BadRequest(
            "This link has expired or was already used. Ask for a new one.".into(),
        ));
    };

    let hash = auth::hash_password(body.password).await?;
    let mut tx = state.db.begin().await?;
    let used = sqlx::query("UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL")
        .bind(reset_id)
        .execute(&mut *tx)
        .await?;
    if used.rows_affected() == 0 {
        return Err(ApiError::BadRequest(
            "This link has expired or was already used. Ask for a new one.".into(),
        ));
    }
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&hash)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM password_resets WHERE user_id = $1 AND id <> $2")
        .bind(user_id)
        .bind(reset_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    // The new password should work right away, even after too many wrong ones.
    login_guard::clear_account(&state.redis, &login_guard::account_key(Some(user_id), &username)).await;
    activity::record_account(
        &state.db,
        Some(user_id),
        &username,
        "reset their password",
        &ip,
        Some(json!({ "via": "email link" })),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}
