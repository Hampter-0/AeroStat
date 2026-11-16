use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::activity;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::login_guard;
use crate::mailer;
use crate::passkeys;
use crate::site_settings;
use crate::state::AppState;
use crate::two_factor;

use super::session::{start_session, LoginResponse};

/// How long a code by email stays valid, the same as the challenge around it.
const CODE_SECONDS: i64 = passkeys::CHALLENGE_SECONDS as i64;
const MAX_ATTEMPTS: u32 = 5;
/// Wrong codes per account within the lockout window, across every sign-in.
/// A correct password doesn't reset this, so guessing can't start over.
const MAX_CODES_PER_ACCOUNT: i64 = 10;
const RESEND_SECONDS: i64 = 60;

#[derive(Serialize)]
pub struct TwoFactorStatus {
    app: bool,
    email: bool,
    app_available: bool,
    email_available: bool,
    email_address: Option<String>,
    recovery_codes_left: i64,
    required: bool,
    /// The method shown first at sign-in, None when neither is on.
    preferred: Option<&'static str>,
}

#[derive(Deserialize)]
pub struct PreferredBody {
    method: String,
}

#[derive(Deserialize)]
pub struct PasswordBody {
    password: String,
}

#[derive(Deserialize)]
pub struct CodeBody {
    code: String,
}

#[derive(Serialize)]
pub struct AppSetup {
    qr: String,
    secret: String,
}

#[derive(Serialize)]
pub struct Enabled {
    recovery_codes: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct RecoveryCodes {
    recovery_codes: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct EmailCode {
    hash: String,
    attempts: u32,
    sent_at: i64,
}

/// A password was right and a second factor is still needed. Kept in Redis.
#[derive(Serialize, Deserialize)]
pub(super) struct LoginChallenge {
    user_id: i64,
    ip: String,
    details: Option<Value>,
    attempts: u32,
    email_code: Option<EmailCode>,
}

#[derive(Serialize)]
pub struct ChallengeView {
    challenge_id: String,
    methods: Vec<&'static str>,
    email_hint: Option<String>,
}

#[derive(Deserialize)]
pub struct ChallengeBody {
    challenge_id: String,
}

#[derive(Deserialize)]
pub struct VerifyBody {
    challenge_id: String,
    code: String,
}

#[derive(sqlx::FromRow)]
struct Factors {
    username: String,
    email: Option<String>,
    password_hash: String,
    totp_secret: Option<String>,
    totp_last_step: Option<i64>,
    email_two_factor: bool,
    two_factor_required: bool,
    two_factor_preferred: Option<String>,
}

/// The method sign-in asks for first: the chosen one when both are on,
/// otherwise the only one that is on.
fn preferred(f: &Factors) -> Option<&'static str> {
    let app = f.totp_secret.is_some();
    let email = f.email_two_factor && f.email.is_some();
    match (app, email) {
        (true, true) if f.two_factor_preferred.as_deref() == Some("email") => Some("email"),
        (true, _) => Some("app"),
        (false, true) => Some("email"),
        (false, false) => None,
    }
}

async fn factors(db: &PgPool, user_id: i64) -> Result<Factors, ApiError> {
    let row = sqlx::query_as(
        r#"
        SELECT username, email, password_hash, totp_secret, totp_last_step, email_two_factor, two_factor_required,
               two_factor_preferred
        FROM users WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

async fn require_password(state: &AppState, user_id: i64, password: String, factors: &Factors) -> Result<(), ApiError> {
    login_guard::verify_current_password(&state.redis, &state.login_limits, user_id, password, factors.password_hash.clone()).await
}

async fn site_name(db: &PgPool) -> String {
    site_settings::all(db)
        .await
        .ok()
        .and_then(|mut values| values.remove(site_settings::SITE_NAME))
        .unwrap_or_else(|| "AeroStat".to_string())
}

fn email_hint(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let first: String = local.chars().take(1).collect();
            format!("{first}…@{domain}")
        }
        None => "your email address".to_string(),
    }
}

async fn send_code(db: &PgPool, to: &str, code: &str, purpose: &str) -> Result<(), ApiError> {
    let site = site_name(db).await;
    let text = format!(
        "Your {site} code is {code}.\n\nUse it to {purpose}. It works for 5 minutes. If you didn't ask for it, change your password."
    );
    let html = format!(
        r#"<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:480px;margin:0 auto;padding:28px 32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<p style="margin:0 0 12px;font-size:15px;color:#334155">Your code to {purpose}:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">{code}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">It works for 5 minutes. If you didn't ask for it, change your password.</p>
</div></body></html>"#
    );
    mailer::send(mailer::Email {
        to: to.to_string(),
        subject: format!("[{site}] Your code is {code}"),
        html,
        text,
        site_name: site,
    })
    .await
    .map_err(|e| ApiError::BadRequest(format!("The code could not be sent: {e}")))
}

/// Ten new recovery codes; the old ones stop working.
async fn replace_recovery_codes(db: &PgPool, user_id: i64) -> Result<Vec<String>, ApiError> {
    let codes = two_factor::new_recovery_codes();
    let mut tx = db.begin().await?;
    sqlx::query("DELETE FROM recovery_codes WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    for (_, hash) in &codes {
        sqlx::query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)")
            .bind(user_id)
            .bind(hash)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(codes.into_iter().map(|(code, _)| code).collect())
}

/// Recovery codes are made with the first method, so the user always has a way back in.
async fn recovery_codes_if_first(db: &PgPool, user_id: i64) -> Result<Option<Vec<String>>, ApiError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL")
        .bind(user_id)
        .fetch_one(db)
        .await?;
    if count > 0 {
        return Ok(None);
    }
    Ok(Some(replace_recovery_codes(db, user_id).await?))
}

/// After a method is turned off: refuses if the account needs two-factor and
/// nothing is left, and drops the recovery codes once no method is on.
async fn after_disable(db: &PgPool, user_id: i64) -> Result<(), ApiError> {
    let f = factors(db, user_id).await?;
    if f.totp_secret.is_none() && !f.email_two_factor {
        sqlx::query("DELETE FROM recovery_codes WHERE user_id = $1")
            .bind(user_id)
            .execute(db)
            .await?;
    }
    Ok(())
}

async fn would_leave_nothing(db: &PgPool, user_id: i64, f: &Factors, removing_app: bool) -> Result<bool, ApiError> {
    let other = if removing_app { f.email_two_factor } else { f.totp_secret.is_some() };
    if other || !f.two_factor_required {
        return Ok(false);
    }
    // A passkey only stands in for two-factor when password sign-in is off,
    // otherwise the password alone still gets in.
    let passkey_only: bool = sqlx::query_scalar(
        "SELECT NOT password_login AND EXISTS (SELECT 1 FROM passkeys WHERE user_id = $1) FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(db)
    .await?;
    Ok(!passkey_only)
}

fn setup_key(kind: &str, user_id: i64) -> String {
    format!("twofactor:setup:{kind}:{user_id}")
}

fn login_key(challenge_id: &str) -> String {
    format!("twofactor:login:{challenge_id}")
}

pub async fn status(State(state): State<AppState>, user: CurrentUser) -> Result<Json<TwoFactorStatus>, ApiError> {
    let f = factors(&state.db, user.id).await?;
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    let first = preferred(&f);
    Ok(Json(TwoFactorStatus {
        app: f.totp_secret.is_some(),
        email: f.email_two_factor,
        app_available: two_factor::app_available(),
        email_available: mailer::config().is_some() && f.email.is_some(),
        email_address: f.email,
        recovery_codes_left: left,
        required: f.two_factor_required,
        preferred: first,
    }))
}

/// Picks which method sign-in asks for first. Both must be on to choose.
pub async fn set_preferred(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<PreferredBody>,
) -> Result<StatusCode, ApiError> {
    let f = factors(&state.db, user.id).await?;
    let (method, label) = match body.method.as_str() {
        "app" if f.totp_secret.is_some() => ("app", "the authenticator app"),
        "email" if f.email_two_factor && f.email.is_some() => ("email", "email codes"),
        _ => return Err(ApiError::BadRequest("Turn that method on first".into())),
    };
    if preferred(&f) == Some(method) {
        return Ok(StatusCode::NO_CONTENT);
    }
    sqlx::query("UPDATE users SET two_factor_preferred = $1 WHERE id = $2")
        .bind(method)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    activity::record(
        &state.db,
        &user,
        "account",
        &format!("made {label} the first two-factor method"),
        None,
        "",
        None,
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

/// Step one of the app: a new secret as a QR code, kept aside until confirmed.
pub async fn start_app(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<PasswordBody>,
) -> Result<Json<AppSetup>, ApiError> {
    if !two_factor::app_available() {
        return Err(ApiError::BadRequest(
            "The server has no SECRET_KEY yet, so the authenticator app can't be used. Email codes still work.".into(),
        ));
    }
    let f = factors(&state.db, user.id).await?;
    require_password(&state, user.id, body.password, &f).await?;
    let secret = two_factor::new_secret();
    let totp = two_factor::totp(secret.clone(), &site_name(&state.db).await, &f.username)?;
    let qr = totp.get_qr_base64().map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    passkeys::save_state(&state.redis, &setup_key("app", user.id), &hex::encode(&secret)).await?;
    Ok(Json(AppSetup {
        qr,
        secret: totp.get_secret_base32(),
    }))
}

/// Step two: the first code from the app turns it on.
pub async fn confirm_app(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<CodeBody>,
) -> Result<Json<Enabled>, ApiError> {
    let pending: String = passkeys::take_state(&state.redis, &setup_key("app", user.id)).await?;
    let secret = hex::decode(pending).map_err(|e| ApiError::Internal(e.into()))?;
    let f = factors(&state.db, user.id).await?;
    let totp = two_factor::totp(secret.clone(), &site_name(&state.db).await, &f.username)?;
    let Some(step) = two_factor::check_app_code(&totp, &body.code, None) else {
        passkeys::save_state(&state.redis, &setup_key("app", user.id), &hex::encode(&secret)).await?;
        return Err(ApiError::BadRequest("That code is not right. Check the time on your phone and try again.".into()));
    };
    let stored = two_factor::encrypt(&secret)?;
    sqlx::query("UPDATE users SET totp_secret = $1, totp_last_step = $2 WHERE id = $3")
        .bind(&stored)
        .bind(step)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    let codes = recovery_codes_if_first(&state.db, user.id).await?;
    activity::record(&state.db, &user, "account", "turned on the authenticator app", None, "", None).await;
    Ok(Json(Enabled { recovery_codes: codes }))
}

pub async fn disable_app(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<PasswordBody>,
) -> Result<StatusCode, ApiError> {
    let f = factors(&state.db, user.id).await?;
    require_password(&state, user.id, body.password, &f).await?;
    if would_leave_nothing(&state.db, user.id, &f, true).await? {
        return Err(ApiError::BadRequest(
            "Your account needs two-factor sign-in. Turn on email codes or add a passkey first.".into(),
        ));
    }
    sqlx::query("UPDATE users SET totp_secret = NULL, totp_last_step = NULL WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;
    after_disable(&state.db, user.id).await?;
    activity::record(&state.db, &user, "account", "turned off the authenticator app", None, "", None).await;
    Ok(StatusCode::NO_CONTENT)
}

/// Step one of email codes: sends a code to prove the address works.
pub async fn start_email(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<PasswordBody>,
) -> Result<StatusCode, ApiError> {
    let f = factors(&state.db, user.id).await?;
    require_password(&state, user.id, body.password, &f).await?;
    let Some(email) = f.email.clone() else {
        return Err(ApiError::BadRequest("Add an email address to your profile first".into()));
    };
    if mailer::config().is_none() {
        return Err(ApiError::BadRequest("Email is not set up on this server".into()));
    }
    let code = two_factor::new_email_code();
    send_code(&state.db, &email, &code, "turn on email codes").await?;
    let pending = EmailCode {
        hash: two_factor::hash_code(&code),
        attempts: 0,
        sent_at: chrono::Utc::now().timestamp(),
    };
    passkeys::save_state(&state.redis, &setup_key("email", user.id), &pending).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn confirm_email(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<CodeBody>,
) -> Result<Json<Enabled>, ApiError> {
    let mut pending: EmailCode = passkeys::take_state(&state.redis, &setup_key("email", user.id)).await?;
    if !two_factor::codes_match(&body.code, &pending.hash) {
        pending.attempts += 1;
        if pending.attempts < MAX_ATTEMPTS {
            passkeys::save_state(&state.redis, &setup_key("email", user.id), &pending).await?;
            return Err(ApiError::BadRequest("That code is not right".into()));
        }
        return Err(ApiError::BadRequest("Too many wrong codes. Send a new one.".into()));
    }
    sqlx::query("UPDATE users SET email_two_factor = true WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;
    let codes = recovery_codes_if_first(&state.db, user.id).await?;
    activity::record(&state.db, &user, "account", "turned on email codes", None, "", None).await;
    Ok(Json(Enabled { recovery_codes: codes }))
}

pub async fn disable_email(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<PasswordBody>,
) -> Result<StatusCode, ApiError> {
    let f = factors(&state.db, user.id).await?;
    require_password(&state, user.id, body.password, &f).await?;
    if would_leave_nothing(&state.db, user.id, &f, false).await? {
        return Err(ApiError::BadRequest(
            "Your account needs two-factor sign-in. Turn on the authenticator app or add a passkey first.".into(),
        ));
    }
    sqlx::query("UPDATE users SET email_two_factor = false WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;
    after_disable(&state.db, user.id).await?;
    activity::record(&state.db, &user, "account", "turned off email codes", None, "", None).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn new_recovery_codes(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<PasswordBody>,
) -> Result<Json<RecoveryCodes>, ApiError> {
    let f = factors(&state.db, user.id).await?;
    require_password(&state, user.id, body.password, &f).await?;
    if f.totp_secret.is_none() && !f.email_two_factor {
        return Err(ApiError::BadRequest("Turn on two-factor sign-in first".into()));
    }
    let codes = replace_recovery_codes(&state.db, user.id).await?;
    activity::record(&state.db, &user, "account", "made new recovery codes", None, "", None).await;
    Ok(Json(RecoveryCodes { recovery_codes: codes }))
}

/// Called after a correct password. Returns a challenge when the account has
/// a second factor, or None when the sign-in can go ahead.
pub(super) async fn challenge_for(
    state: &AppState,
    user_id: i64,
    ip: &str,
    details: Option<Value>,
) -> Result<Option<ChallengeView>, ApiError> {
    let f = factors(&state.db, user_id).await?;
    // The preferred method comes first; the sign-in page opens on it.
    let Some(first) = preferred(&f) else {
        return Ok(None);
    };
    let mut methods: Vec<&'static str> = vec![first];
    if first != "app" && f.totp_secret.is_some() {
        methods.push("app");
    }
    if first != "email" && f.email_two_factor && f.email.is_some() {
        methods.push("email");
    }
    methods.push("recovery");

    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let challenge_id = hex::encode(bytes);
    let challenge = LoginChallenge {
        user_id,
        ip: ip.to_string(),
        details,
        attempts: 0,
        email_code: None,
    };
    passkeys::save_state(&state.redis, &login_key(&challenge_id), &challenge).await?;
    Ok(Some(ChallengeView {
        challenge_id,
        methods,
        email_hint: f.email.as_deref().map(email_hint),
    }))
}

fn check_challenge_id(id: &str) -> Result<(), ApiError> {
    if id.len() != 32 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ApiError::BadRequest("This sign-in expired. Start again.".into()));
    }
    Ok(())
}

/// Sends the sign-in code by email, at most once a minute.
pub async fn send_login_code(
    State(state): State<AppState>,
    Json(body): Json<ChallengeBody>,
) -> Result<StatusCode, ApiError> {
    check_challenge_id(&body.challenge_id)?;
    let key = login_key(&body.challenge_id);
    let mut challenge: LoginChallenge = passkeys::take_state(&state.redis, &key)
        .await
        .map_err(|_| ApiError::BadRequest("This sign-in expired. Start again.".into()))?;
    let now = chrono::Utc::now().timestamp();
    if let Some(previous) = &challenge.email_code {
        if now - previous.sent_at < RESEND_SECONDS {
            passkeys::save_state(&state.redis, &key, &challenge).await?;
            return Err(ApiError::BadRequest("A code was just sent. Wait a minute before asking for another.".into()));
        }
    }
    let f = factors(&state.db, challenge.user_id).await?;
    let Some(email) = f.email.filter(|_| f.email_two_factor) else {
        passkeys::save_state(&state.redis, &key, &challenge).await?;
        return Err(ApiError::BadRequest("Email codes are not on for this account".into()));
    };
    let code = two_factor::new_email_code();
    let sent = send_code(&state.db, &email, &code, "sign in").await;
    challenge.email_code = Some(EmailCode {
        hash: two_factor::hash_code(&code),
        attempts: 0,
        sent_at: now,
    });
    passkeys::save_state(&state.redis, &key, &challenge).await?;
    sent?;
    Ok(StatusCode::NO_CONTENT)
}

/// The second step: an app code, an email code or a recovery code.
pub async fn verify_login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<VerifyBody>,
) -> Result<Json<LoginResponse>, ApiError> {
    check_challenge_id(&body.challenge_id)?;
    let key = login_key(&body.challenge_id);
    let mut challenge: LoginChallenge = passkeys::take_state(&state.redis, &key)
        .await
        .map_err(|_| ApiError::BadRequest("This sign-in expired. Start again.".into()))?;
    let f = factors(&state.db, challenge.user_id).await?;
    let account_key = format!("twofactor:fail:user:{}", challenge.user_id);
    login_guard::hit_user_limit(
        &state.redis,
        &account_key,
        MAX_CODES_PER_ACCOUNT,
        state.login_limits.lockout_minutes * 60,
        "wrong codes",
    )
    .await?;

    let mut accepted = false;
    let mut method = "";
    if two_factor::looks_like_recovery_code(&body.code) {
        let used: Option<i64> = sqlx::query_scalar(
            "UPDATE recovery_codes SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING id",
        )
        .bind(challenge.user_id)
        .bind(two_factor::hash_code(&body.code))
        .fetch_optional(&state.db)
        .await?;
        if used.is_some() {
            accepted = true;
            method = "recovery code";
        }
    } else {
        if let Some(stored) = &f.totp_secret {
            let secret = two_factor::decrypt(stored).map_err(|_| {
                ApiError::BadRequest("The authenticator app can't be checked: the server's SECRET_KEY changed. Use a recovery code or email code.".into())
            });
            if let Ok(secret) = secret {
                let totp = two_factor::totp(secret, &site_name(&state.db).await, &f.username)?;
                if let Some(step) = two_factor::check_app_code(&totp, &body.code, f.totp_last_step) {
                    // Only one request can move the step forward, so a code
                    // sent twice at the same moment still works once.
                    let moved = sqlx::query(
                        "UPDATE users SET totp_last_step = $1 WHERE id = $2 AND (totp_last_step IS NULL OR totp_last_step < $1)",
                    )
                    .bind(step)
                    .bind(challenge.user_id)
                    .execute(&state.db)
                    .await?;
                    if moved.rows_affected() == 1 {
                        accepted = true;
                        method = "authenticator app";
                    }
                }
            }
        }
        if !accepted {
            if let Some(code) = &challenge.email_code {
                let fresh = chrono::Utc::now().timestamp() - code.sent_at < CODE_SECONDS;
                if fresh && two_factor::codes_match(&body.code, &code.hash) {
                    accepted = true;
                    method = "email code";
                }
            }
        }
    }

    if !accepted {
        challenge.attempts += 1;
        if challenge.attempts >= MAX_ATTEMPTS {
            login_guard::record_failure(&state.redis, &state.login_limits, &challenge.ip, None).await;
            return Err(ApiError::BadRequest("Too many wrong codes. Sign in again.".into()));
        }
        passkeys::save_state(&state.redis, &key, &challenge).await?;
        return Err(ApiError::BadRequest("That code is not right".into()));
    }

    login_guard::release_user_limit(&state.redis, &account_key).await;
    let mut details = challenge.details.unwrap_or_else(|| json!({}));
    details["second_factor"] = json!(method);
    start_session(&state, challenge.user_id, &headers, &challenge.ip, Some(details)).await
}
