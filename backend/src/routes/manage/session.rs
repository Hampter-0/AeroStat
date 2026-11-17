use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::activity;
use crate::auth::{self, CurrentUser};
use crate::error::ApiError;
use crate::login_guard;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

/// Either a session, or a challenge when a second factor is still needed.
#[derive(Serialize)]
#[serde(untagged)]
pub enum LoginReply {
    Session(LoginResponse),
    TwoFactor { two_factor: super::two_factor::ChallengeView },
}

#[derive(Serialize)]
pub struct LoginResponse {
    token: String,
    expires_at: DateTime<Utc>,
    user: CurrentUser,
}

#[derive(sqlx::FromRow)]
struct LoginRow {
    id: i64,
    password_hash: String,
    password_login: bool,
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginReply>, ApiError> {
    let login = body.username.trim().to_lowercase();
    let ip = login_guard::client_ip(&headers);
    let details = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(|agent| serde_json::json!({ "user_agent": agent }));

    let query = if login.contains('@') {
        "SELECT id, password_hash, password_login FROM users WHERE lower(email) = $1"
    } else {
        "SELECT id, password_hash, password_login FROM users WHERE username = $1"
    };
    let row: Option<LoginRow> = sqlx::query_as(query)
        .bind(&login)
        .fetch_optional(&state.db)
        .await?;

    let limits = state.login_limits;
    let account = login_guard::account_key(row.as_ref().map(|row| row.id), &login);
    // An IP this account signed in from lately belongs to its owner, so the
    // account-wide block (meant for guessing from many addresses) skips it.
    let known_ip = match &row {
        Some(row) if ip != "unknown" => sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM activity_log
                WHERE user_id = $1 AND ip = $2 AND action = 'signed in' AND created_at > now() - interval '90 days'
            )
            "#,
        )
        .bind(row.id)
        .bind(&ip)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false),
        _ => false,
    };
    let account_limit = if known_ip { None } else { Some(account.as_str()) };
    let reached_limit = login_guard::reserve(&state.redis, &limits, &ip, account_limit).await?;

    let (found_id, hash, password_login) = match row {
        Some(row) => (Some(row.id), row.password_hash, row.password_login),
        None => (None, auth::dummy_hash(), true),
    };
    let valid = auth::verify_password(body.password, hash).await;
    let user_id = match found_id {
        Some(id) if valid => id,
        _ => {
            if reached_limit {
                activity::record_account(&state.db, found_id, &login, "was blocked after too many failed sign-ins", &ip, details).await;
                if found_id.is_some() {
                    crate::notifications::notify_admins(
                        &state.db,
                        crate::notifications::AdminNotice {
                            kind: "admin_account_locked",
                            title: format!("Sign-in for {login} was blocked"),
                            description: format!(
                                "Too many wrong passwords. New attempts are refused for {} minutes.",
                                limits.lockout_minutes
                            ),
                            fields: vec![("Account", login.clone()), ("IP address", ip.clone())],
                            path: "/manage/activity",
                            actor: None,
                        },
                    );
                }
            }
            return Err(ApiError::BadRequest("Invalid username, email or password".into()));
        }
    };
    login_guard::release_ip(&state.redis, &ip).await;
    login_guard::clear_account(&state.redis, &account).await;
    // Only said after a correct password, so it doesn't tell strangers anything.
    if !password_login {
        return Err(ApiError::BadRequest(
            "Password sign-in is turned off for this account. Sign in with a passkey.".into(),
        ));
    }

    if let Some(challenge) = super::two_factor::challenge_for(&state, user_id, &ip, details.clone()).await? {
        return Ok(Json(LoginReply::TwoFactor { two_factor: challenge }));
    }
    let Json(session) = start_session(&state, user_id, &headers, &ip, details).await?;
    Ok(Json(LoginReply::Session(session)))
}

/// Opens a session after a successful sign-in, by password or passkey.
pub(super) async fn start_session(
    state: &AppState,
    user_id: i64,
    headers: &HeaderMap,
    ip: &str,
    details: Option<serde_json::Value>,
) -> Result<Json<LoginResponse>, ApiError> {
    sqlx::query("UPDATE users SET last_login_at = now() WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE expires_at <= now()")
        .execute(&state.db)
        .await?;

    let (token, token_hash) = auth::new_session_token();
    let (expires_at,): (DateTime<Utc>,) = sqlx::query_as(
        r#"
        INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
        VALUES ($1, $2, now() + make_interval(days => $3), $4, $5)
        RETURNING expires_at
        "#,
    )
    .bind(&token_hash)
    .bind(user_id)
    .bind(state.session_days)
    .bind(auth::known_ip(ip))
    .bind(auth::user_agent(headers))
    .fetch_one(&state.db)
    .await?;

    let user = auth::load_user(&state.db, user_id).await?;
    activity::record_account(&state.db, Some(user.id), &user.username, "signed in", ip, details).await;

    Ok(Json(LoginResponse { token, expires_at, user }))
}

pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<StatusCode, ApiError> {
    if let Some(token) = auth::bearer_token(&headers) {
        sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
            .bind(auth::hash_token(&token))
            .execute(&state.db)
            .await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn me(user: CurrentUser) -> Json<CurrentUser> {
    Json(user)
}
