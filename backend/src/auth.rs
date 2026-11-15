use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::HeaderMap;
use rand::RngCore;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::error::ApiError;
use crate::state::AppState;

pub const PERMISSIONS: [&str; 4] = ["incidents", "maintenance", "services", "settings"];

pub const SESSION_DAYS: i32 = 30;

pub async fn hash_password(password: String) -> anyhow::Result<String> {
    tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| anyhow::anyhow!("hashing failed: {e}"))
    })
    .await?
}

pub async fn verify_password(password: String, hash: String) -> bool {
    tokio::task::spawn_blocking(move || match PasswordHash::new(&hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    })
    .await
    .unwrap_or(false)
}

/// Returns (token for the client, hash to store). Only the hash ever hits the database.
pub fn new_session_token() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    let hash = hash_token(&token);
    (token, hash)
}

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

pub fn validate_permissions(permissions: &[String]) -> Result<(), ApiError> {
    for permission in permissions {
        if !PERMISSIONS.contains(&permission.as_str()) {
            return Err(ApiError::BadRequest(format!("Unknown permission: {permission}")));
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CurrentUser {
    pub id: i64,
    pub username: String,
    pub is_admin: bool,
    pub permissions: Vec<String>,
}

impl CurrentUser {
    pub fn require(&self, permission: &str) -> Result<(), ApiError> {
        if self.is_admin || self.permissions.iter().any(|p| p == permission) {
            return Ok(());
        }
        Err(ApiError::Forbidden)
    }

    pub fn require_admin(&self) -> Result<(), ApiError> {
        if self.is_admin {
            return Ok(());
        }
        Err(ApiError::Forbidden)
    }
}

pub fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let header = headers.get(axum::http::header::AUTHORIZATION)?;
    let value = header.to_str().ok()?;
    value.strip_prefix("Bearer ").map(|token| token.trim().to_string())
}

#[axum::async_trait]
impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer_token(&parts.headers).ok_or(ApiError::Unauthorized)?;

        let user: Option<CurrentUser> = sqlx::query_as(
            r#"
            SELECT u.id, u.username, u.is_admin, u.permissions
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = $1 AND s.expires_at > now()
            "#,
        )
        .bind(hash_token(&token))
        .fetch_optional(&state.db)
        .await?;

        user.ok_or(ApiError::Unauthorized)
    }
}
