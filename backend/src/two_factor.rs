//! Two-factor sign-in helpers: the authenticator app secret (stored encrypted
//! with SECRET_KEY), one-time codes and recovery codes.

use std::sync::OnceLock;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::{Rng, RngCore};
use sha2::{Digest, Sha256};
use totp_rs::{Algorithm, Secret, TOTP};

/// Each code is valid for 30 seconds; one step either side is accepted for clock drift.
const STEP_SECONDS: u64 = 30;
const RECOVERY_ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
pub const RECOVERY_CODE_COUNT: usize = 10;

static SECRET_KEY: OnceLock<Option<[u8; 32]>> = OnceLock::new();

pub fn init(key: Option<[u8; 32]>) {
    let _ = SECRET_KEY.set(key);
}

/// Without SECRET_KEY the authenticator app can't be set up; email codes still work.
pub fn app_available() -> bool {
    matches!(SECRET_KEY.get(), Some(Some(_)))
}

fn cipher() -> anyhow::Result<Aes256Gcm> {
    match SECRET_KEY.get() {
        Some(Some(key)) => Ok(Aes256Gcm::new_from_slice(key).map_err(|e| anyhow::anyhow!("{e}"))?),
        _ => anyhow::bail!("SECRET_KEY is not set"),
    }
}

pub fn encrypt(plain: &[u8]) -> anyhow::Result<String> {
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    let sealed = cipher()?
        .encrypt(Nonce::from_slice(&nonce), plain)
        .map_err(|_| anyhow::anyhow!("could not encrypt"))?;
    Ok(format!("v1:{}{}", hex::encode(nonce), hex::encode(sealed)))
}

/// Fails when SECRET_KEY changed since the value was stored.
pub fn decrypt(text: &str) -> anyhow::Result<Vec<u8>> {
    let Some(body) = text.strip_prefix("v1:") else {
        anyhow::bail!("unknown format");
    };
    let bytes = hex::decode(body)?;
    if bytes.len() < 13 {
        anyhow::bail!("too short");
    }
    let (nonce, sealed) = bytes.split_at(12);
    cipher()?
        .decrypt(Nonce::from_slice(nonce), sealed)
        .map_err(|_| anyhow::anyhow!("SECRET_KEY changed or the value is damaged"))
}

pub fn new_secret() -> Vec<u8> {
    Secret::generate_secret().to_bytes().unwrap_or_else(|_| {
        let mut bytes = vec![0u8; 20];
        rand::thread_rng().fill_bytes(&mut bytes);
        bytes
    })
}

/// The issuer and account name can't contain ':' in an otpauth link.
fn label(text: &str) -> String {
    text.replace(':', " ")
}

pub fn totp(secret: Vec<u8>, issuer: &str, account: &str) -> anyhow::Result<TOTP> {
    TOTP::new(Algorithm::SHA1, 6, 1, STEP_SECONDS, secret, Some(label(issuer)), label(account))
        .map_err(|e| anyhow::anyhow!("{e:?}"))
}

/// Returns the time step the code belongs to, if it is right and newer than
/// the last one used. Comparing in constant time keeps timing from leaking it.
pub fn check_app_code(totp: &TOTP, code: &str, last_step: Option<i64>) -> Option<i64> {
    let code = code.trim().replace(' ', "");
    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let now = chrono::Utc::now().timestamp() as u64;
    let current = now / STEP_SECONDS;
    let mut matched = None;
    for step in [current - 1, current, current + 1] {
        let expected = totp.generate(step * STEP_SECONDS);
        if constant_eq(expected.as_bytes(), code.as_bytes()) {
            matched = Some(step as i64);
        }
    }
    let step = matched?;
    if let Some(last) = last_step {
        if step <= last {
            return None;
        }
    }
    Some(step)
}

fn constant_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Six digits for a code sent by email.
pub fn new_email_code() -> String {
    format!("{:06}", rand::thread_rng().gen_range(0..1_000_000))
}

pub fn hash_code(code: &str) -> String {
    let normalized: String = code.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase();
    hex::encode(Sha256::digest(normalized.as_bytes()))
}

pub fn codes_match(code: &str, hash: &str) -> bool {
    constant_eq(hash_code(code).as_bytes(), hash.as_bytes())
}

/// Ten codes like "k7m2p-x9qrt-4vbn" with their hashes; only the hashes are stored.
pub fn new_recovery_codes() -> Vec<(String, String)> {
    let mut rng = rand::thread_rng();
    (0..RECOVERY_CODE_COUNT)
        .map(|_| {
            let chars: String = (0..15)
                .map(|_| RECOVERY_ALPHABET[rng.gen_range(0..RECOVERY_ALPHABET.len())] as char)
                .collect();
            let code = format!("{}-{}-{}", &chars[0..5], &chars[5..10], &chars[10..15]);
            let hash = hash_code(&code);
            (code, hash)
        })
        .collect()
}

/// Recovery codes have 15 letters and digits, app and email codes 6 digits.
pub fn looks_like_recovery_code(code: &str) -> bool {
    code.chars().filter(|c| c.is_ascii_alphanumeric()).count() == 15
}
