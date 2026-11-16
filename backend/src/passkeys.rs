//! Passkeys (WebAuthn). The relying party is the status page address from the
//! site settings, because a passkey only works on the domain it was
//! made for. Challenges live in Redis for a few minutes and are used once.

use std::time::Duration;

use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::Pool as RedisPool;
use serde::de::DeserializeOwned;
use serde::Serialize;
use sqlx::PgPool;
use webauthn_rs::prelude::{Url, Uuid};
use webauthn_rs::{Webauthn, WebauthnBuilder};

use crate::error::ApiError;
use crate::site_settings;

/// How long the browser gets to finish a registration or sign-in.
pub const CHALLENGE_SECONDS: u64 = 300;

/// Builds the relying party for the configured status page address.
pub async fn webauthn(db: &PgPool) -> Result<Webauthn, ApiError> {
    let Some(address) = site_settings::public_url(db).await else {
        return Err(ApiError::BadRequest(
            "Passkeys need the status page address. Set it under Settings → General first.".into(),
        ));
    };
    let origin = Url::parse(&address).map_err(|_| ApiError::BadRequest("The status page address is not a valid URL".into()))?;
    let Some(host) = origin.host_str().map(|host| host.to_string()) else {
        return Err(ApiError::BadRequest("The status page address has no host name".into()));
    };
    let site = site_settings::all(db)
        .await
        .ok()
        .and_then(|mut values| values.remove(site_settings::SITE_NAME))
        .unwrap_or_else(|| "AeroStat".to_string());

    WebauthnBuilder::new(&host, &origin)
        .map_err(|e| ApiError::BadRequest(format!("Passkeys can't use this status page address: {e}")))?
        .rp_name(&site)
        .timeout(Duration::from_secs(CHALLENGE_SECONDS))
        .build()
        .map_err(|e| ApiError::BadRequest(format!("Passkeys can't use this status page address: {e}")))
}

/// Whether passkeys can be used at all, for showing or hiding them in the panel.
pub async fn available(db: &PgPool) -> bool {
    webauthn(db).await.is_ok()
}

/// The id the browser stores for this user, made on first use.
pub async fn user_handle(db: &PgPool, user_id: i64) -> Result<Uuid, ApiError> {
    let existing: Option<String> = sqlx::query_scalar("SELECT webauthn_id FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(db)
        .await?;
    let text = match existing {
        Some(text) => text,
        None => {
            let fresh = Uuid::new_v4().to_string();
            sqlx::query("UPDATE users SET webauthn_id = $1 WHERE id = $2 AND webauthn_id IS NULL")
                .bind(&fresh)
                .bind(user_id)
                .execute(db)
                .await?;
            sqlx::query_scalar("SELECT webauthn_id FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(db)
                .await?
        }
    };
    Uuid::parse_str(&text).map_err(|e| ApiError::Internal(e.into()))
}

pub async fn save_state<T: Serialize>(redis: &RedisPool, key: &str, value: &T) -> Result<(), ApiError> {
    let text = serde_json::to_string(value).map_err(|e| ApiError::Internal(e.into()))?;
    let mut conn = redis.get().await.map_err(|e| ApiError::Internal(e.into()))?;
    conn.set_ex::<_, _, ()>(key, text, CHALLENGE_SECONDS)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(())
}

/// Reads and deletes the state, so a challenge can't be answered twice.
pub async fn take_state<T: DeserializeOwned>(redis: &RedisPool, key: &str) -> Result<T, ApiError> {
    let mut conn = redis.get().await.map_err(|e| ApiError::Internal(e.into()))?;
    let text: Option<String> = conn.get_del(key).await.map_err(|e| ApiError::Internal(e.into()))?;
    let Some(text) = text else {
        return Err(ApiError::BadRequest("This passkey request expired. Try again.".into()));
    };
    serde_json::from_str(&text).map_err(|e| ApiError::Internal(e.into()))
}
