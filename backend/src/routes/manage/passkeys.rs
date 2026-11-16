use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use chrono::{DateTime, Utc};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::json;
use webauthn_rs::prelude::{
    CreationChallengeResponse, DiscoverableAuthentication, Passkey, PasskeyRegistration,
    PublicKeyCredential, RegisterPublicKeyCredential, RequestChallengeResponse,
};
use webauthn_rs_proto::ResidentKeyRequirement;

use crate::activity;
use crate::auth::{self, CurrentUser};
use crate::error::ApiError;
use crate::login_guard;
use crate::passkeys;
use crate::state::AppState;

use super::session::{start_session, LoginResponse};

#[derive(Serialize, sqlx::FromRow)]
pub struct PasskeyView {
    id: i64,
    name: String,
    discoverable: bool,
    created_at: DateTime<Utc>,
    last_used_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct PasskeysResponse {
    available: bool,
    password_login: bool,
    passkeys: Vec<PasskeyView>,
}

#[derive(Deserialize)]
pub struct StartRegistration {
    name: String,
    #[serde(default)]
    discoverable: bool,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct RegistrationState {
    name: String,
    discoverable: bool,
    state: PasskeyRegistration,
}

#[derive(Deserialize)]
pub struct FinishRegistration {
    credential: RegisterPublicKeyCredential,
}

#[derive(Deserialize)]
pub struct PasswordLoginBody {
    enabled: bool,
    password: String,
}

#[derive(Serialize)]
pub struct LoginChallenge {
    challenge_id: String,
    options: RequestChallengeResponse,
}

#[derive(Deserialize)]
pub struct FinishLogin {
    challenge_id: String,
    credential: PublicKeyCredential,
}

fn registration_key(user_id: i64) -> String {
    format!("passkey:register:{user_id}")
}

fn login_key(challenge_id: &str) -> String {
    format!("passkey:login:{challenge_id}")
}

async fn require_password(state: &AppState, user: &CurrentUser, password: String) -> Result<(), ApiError> {
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    if !auth::verify_password(password, hash).await {
        return Err(ApiError::BadRequest("Your current password is not correct".into()));
    }
    Ok(())
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<PasskeysResponse>, ApiError> {
    let passkeys = sqlx::query_as(
        "SELECT id, name, discoverable, created_at, last_used_at FROM passkeys WHERE user_id = $1 ORDER BY created_at",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;
    let password_login: bool = sqlx::query_scalar("SELECT password_login FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(PasskeysResponse {
        available: passkeys::available(&state.db).await,
        password_login,
        passkeys,
    }))
}

/// Step one of adding a passkey: checks the password and returns the options
/// the browser needs.
pub async fn start_registration(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<StartRegistration>,
) -> Result<Json<CreationChallengeResponse>, ApiError> {
    let name = body.name.trim().to_string();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(ApiError::BadRequest("Give the passkey a name of at most 60 characters".into()));
    }
    require_password(&state, &user, body.password).await?;
    let taken: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM passkeys WHERE user_id = $1 AND name = $2)")
        .bind(user.id)
        .bind(&name)
        .fetch_one(&state.db)
        .await?;
    if taken {
        return Err(ApiError::Conflict(format!("You already have a passkey called '{name}'")));
    }

    let webauthn = passkeys::webauthn(&state.db).await?;
    let handle = passkeys::user_handle(&state.db, user.id).await?;
    let existing: Vec<Vec<u8>> = sqlx::query_scalar("SELECT credential_id FROM passkeys WHERE user_id = $1")
        .bind(user.id)
        .fetch_all(&state.db)
        .await?;
    let exclude = existing.into_iter().map(Into::into).collect();

    let (mut options, registration) = webauthn
        .start_passkey_registration(handle, &user.username, &user.username, Some(exclude))
        .map_err(|e| ApiError::BadRequest(format!("Could not start adding a passkey: {e}")))?;
    if let Some(selection) = options.public_key.authenticator_selection.as_mut() {
        if body.discoverable {
            selection.resident_key = Some(ResidentKeyRequirement::Required);
            selection.require_resident_key = true;
        } else {
            selection.resident_key = Some(ResidentKeyRequirement::Discouraged);
            selection.require_resident_key = false;
        }
    }

    let saved = RegistrationState {
        name,
        discoverable: body.discoverable,
        state: registration,
    };
    passkeys::save_state(&state.redis, &registration_key(user.id), &saved).await?;
    Ok(Json(options))
}

/// Step two: checks what the browser made and stores the passkey.
pub async fn finish_registration(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<FinishRegistration>,
) -> Result<Json<PasskeyView>, ApiError> {
    let saved: RegistrationState = passkeys::take_state(&state.redis, &registration_key(user.id)).await?;
    let webauthn = passkeys::webauthn(&state.db).await?;
    let passkey: Passkey = webauthn
        .finish_passkey_registration(&body.credential, &saved.state)
        .map_err(|e| ApiError::BadRequest(format!("The passkey could not be added: {e}")))?;

    let credential_id: Vec<u8> = passkey.cred_id().to_vec();
    let stored = serde_json::to_value(&passkey).map_err(|e| ApiError::Internal(e.into()))?;
    let row: Result<PasskeyView, sqlx::Error> = sqlx::query_as(
        r#"
        INSERT INTO passkeys (user_id, name, credential_id, passkey, discoverable)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, discoverable, created_at, last_used_at
        "#,
    )
    .bind(user.id)
    .bind(&saved.name)
    .bind(&credential_id)
    .bind(&stored)
    .bind(saved.discoverable)
    .fetch_one(&state.db)
    .await;
    let row = match row {
        Ok(row) => row,
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            return Err(ApiError::Conflict("This passkey is already added".into()));
        }
        Err(e) => return Err(e.into()),
    };

    let details = json!({ "name": saved.name, "without_username": saved.discoverable });
    activity::record(&state.db, &user, "account", "added a passkey", None, "", Some(details)).await;
    Ok(Json(row))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    let name: Option<String> = sqlx::query_scalar("SELECT name FROM passkeys WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .fetch_optional(&state.db)
        .await?;
    let Some(name) = name else {
        return Err(ApiError::NotFound);
    };
    let (count, password_login): (i64, bool) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM passkeys WHERE user_id = $1), (SELECT password_login FROM users WHERE id = $1)",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;
    if count <= 1 && !password_login {
        return Err(ApiError::BadRequest(
            "This is your last passkey and password sign-in is off. Turn password sign-in back on first.".into(),
        ));
    }
    sqlx::query("DELETE FROM passkeys WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    activity::record(&state.db, &user, "account", "removed a passkey", None, "", Some(json!({ "name": name }))).await;
    Ok(StatusCode::NO_CONTENT)
}

/// Turns password sign-in off or on. Off needs a passkey, so nobody locks
/// themselves out.
pub async fn set_password_login(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<PasswordLoginBody>,
) -> Result<StatusCode, ApiError> {
    require_password(&state, &user, body.password).await?;
    if !body.enabled {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM passkeys WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&state.db)
            .await?;
        if count == 0 {
            return Err(ApiError::BadRequest("Add a passkey before you turn password sign-in off".into()));
        }
    }
    sqlx::query("UPDATE users SET password_login = $1 WHERE id = $2")
        .bind(body.enabled)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    let action = if body.enabled { "turned password sign-in on" } else { "turned password sign-in off" };
    activity::record(&state.db, &user, "account", action, None, "", None).await;
    Ok(StatusCode::NO_CONTENT)
}

/// Step one of signing in with a passkey. The browser lets the user pick one
/// of the passkeys it has for this site, so no username is needed.
pub async fn start_login(State(state): State<AppState>) -> Result<Json<LoginChallenge>, ApiError> {
    let webauthn = passkeys::webauthn(&state.db).await?;
    let (options, authentication) = webauthn
        .start_discoverable_authentication()
        .map_err(|e| ApiError::BadRequest(format!("Could not start signing in: {e}")))?;
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let challenge_id = hex::encode(bytes);
    passkeys::save_state(&state.redis, &login_key(&challenge_id), &authentication).await?;
    Ok(Json(LoginChallenge { challenge_id, options }))
}

#[derive(sqlx::FromRow)]
struct StoredPasskey {
    id: i64,
    user_id: i64,
    passkey: serde_json::Value,
    webauthn_id: Option<String>,
}

/// Step two: checks the passkey and opens a session. A passkey proves more than
/// a password, so it doesn't count towards the sign-in block.
pub async fn finish_login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<FinishLogin>,
) -> Result<Json<LoginResponse>, ApiError> {
    if body.challenge_id.len() != 32 || !body.challenge_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ApiError::BadRequest("This passkey request expired. Try again.".into()));
    }
    let authentication: DiscoverableAuthentication = passkeys::take_state(&state.redis, &login_key(&body.challenge_id)).await?;
    let webauthn = passkeys::webauthn(&state.db).await?;
    let refused = || ApiError::BadRequest("This passkey isn't known here. Sign in with your password instead.".into());

    let (handle, credential_id) = webauthn
        .identify_discoverable_authentication(&body.credential)
        .map_err(|_| refused())?;
    let stored: Option<StoredPasskey> = sqlx::query_as(
        r#"
        SELECT p.id, p.user_id, p.passkey, u.webauthn_id
        FROM passkeys p JOIN users u ON u.id = p.user_id
        WHERE p.credential_id = $1
        "#,
    )
    .bind(credential_id)
    .fetch_optional(&state.db)
    .await?;
    let Some(stored) = stored else {
        return Err(refused());
    };
    if stored.webauthn_id.as_deref() != Some(handle.to_string().as_str()) {
        return Err(refused());
    }
    let mut passkey: Passkey = serde_json::from_value(stored.passkey).map_err(|e| ApiError::Internal(e.into()))?;
    let result = webauthn
        .finish_discoverable_authentication_v2(&body.credential, authentication, &passkey)
        .map_err(|_| refused())?;

    if passkey.update_credential(&result) == Some(true) {
        let updated = serde_json::to_value(&passkey).map_err(|e| ApiError::Internal(e.into()))?;
        sqlx::query("UPDATE passkeys SET passkey = $1 WHERE id = $2")
            .bind(&updated)
            .bind(stored.id)
            .execute(&state.db)
            .await?;
    }
    sqlx::query("UPDATE passkeys SET last_used_at = now() WHERE id = $1")
        .bind(stored.id)
        .execute(&state.db)
        .await?;

    let ip = login_guard::client_ip(&headers);
    let details = json!({ "method": "passkey", "user_agent": auth::user_agent(&headers) });
    start_session(&state, stored.user_id, &headers, &ip, Some(details)).await
}

#[derive(Serialize)]
pub struct LoginOptions {
    passkeys: bool,
}

/// What the sign-in page can offer, without saying anything about accounts.
pub async fn login_options(State(state): State<AppState>) -> Json<LoginOptions> {
    Json(LoginOptions {
        passkeys: passkeys::available(&state.db).await,
    })
}
