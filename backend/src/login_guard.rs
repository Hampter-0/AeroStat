use axum::http::HeaderMap;
use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::Pool;
use sqlx::PgPool;

use crate::error::ApiError;

/// Set with LOGIN_MAX_FAILURES_PER_IP, LOGIN_MAX_FAILURES_PER_ACCOUNT and
/// LOGIN_LOCKOUT_MINUTES. The account limit is higher than the IP limit so one
/// attacker can't easily lock a real user out, but it still caps guessing from
/// many addresses.
#[derive(Debug, Clone, Copy)]
pub struct LoginLimits {
    pub per_ip: i64,
    pub per_account: i64,
    pub lockout_minutes: i64,
}

fn ip_key(ip: &str) -> String {
    format!("login:fail:ip:{}", ip.to_lowercase())
}

/// Failures count per account, so signing in with the username or the email
/// address adds up. Logins that match no account count per typed name.
pub fn account_key(user_id: Option<i64>, login: &str) -> String {
    match user_id {
        Some(id) => format!("login:fail:account:user:{id}"),
        None => format!("login:fail:account:name:{login}"),
    }
}

fn limits(config: &LoginLimits, ip: &str, account: &str) -> [(String, i64); 2] {
    [(ip_key(ip), config.per_ip), (account.to_string(), config.per_account)]
}

/// The visitor's IP as passed on by the frontend. Without the header every
/// request shares the "unknown" bucket.
pub fn client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Refuses the attempt while this IP or account has too many recent failures.
/// If Redis is unreachable, sign-in keeps working.
pub async fn check(redis: &Pool, config: &LoginLimits, ip: &str, account: &str) -> Result<(), ApiError> {
    let blocked = match blocked_seconds(redis, config, ip, account).await {
        Ok(seconds) => seconds,
        Err(e) => {
            tracing::warn!("Login guard unavailable, allowing the attempt: {e}");
            None
        }
    };
    if let Some(seconds) = blocked {
        let minutes = ((seconds + 59) / 60).max(1);
        let unit = if minutes == 1 { "minute" } else { "minutes" };
        return Err(ApiError::TooManyRequests(format!(
            "Too many failed sign-in attempts. Try again in {minutes} {unit}."
        )));
    }
    Ok(())
}

async fn blocked_seconds(redis: &Pool, config: &LoginLimits, ip: &str, account: &str) -> anyhow::Result<Option<i64>> {
    let mut conn = redis.get().await?;
    let mut longest: Option<i64> = None;
    for (key, max) in limits(config, ip, account) {
        let count: Option<i64> = conn.get(&key).await?;
        if count.unwrap_or(0) >= max {
            let ttl: i64 = conn.ttl(&key).await?;
            longest = Some(longest.unwrap_or(0).max(ttl.max(1)));
        }
    }
    Ok(longest)
}

/// Counts a failed attempt. Returns true when this failure hit a limit, so the
/// caller can log the lockout once.
pub async fn record_failure(redis: &Pool, config: &LoginLimits, ip: &str, account: &str) -> bool {
    match count_failure(redis, config, ip, account).await {
        Ok(reached) => reached,
        Err(e) => {
            tracing::warn!("Could not count a failed sign-in: {e}");
            false
        }
    }
}

async fn count_failure(redis: &Pool, config: &LoginLimits, ip: &str, account: &str) -> anyhow::Result<bool> {
    let mut conn = redis.get().await?;
    let mut reached = false;
    for (key, max) in limits(config, ip, account) {
        let count: i64 = conn.incr(&key, 1).await?;
        if count == 1 {
            conn.expire::<_, ()>(&key, config.lockout_minutes * 60).await?;
        }
        if count == max {
            reached = true;
        }
    }
    Ok(reached)
}

/// A successful sign-in resets the account counter. The IP counter stays, so
/// signing in to your own account can't be used to keep guessing another.
pub async fn clear_account(redis: &Pool, account: &str) {
    let result: anyhow::Result<()> = async {
        let mut conn = redis.get().await?;
        conn.del::<_, ()>(account).await?;
        Ok(())
    }
    .await;
    if let Err(e) = result {
        tracing::warn!("Could not reset failed sign-ins: {e}");
    }
}

/// Lifts every block for a username, email address or IP. Returns how many
/// counters were removed.
pub async fn unblock(db: &PgPool, redis: &Pool, input: &str) -> anyhow::Result<usize> {
    let input = input.trim().to_lowercase();
    let user: Option<(i64,)> = sqlx::query_as("SELECT id FROM users WHERE username = $1 OR lower(email) = $1")
        .bind(&input)
        .fetch_optional(db)
        .await?;

    let mut keys = vec![ip_key(&input), account_key(None, &input)];
    if let Some((id,)) = user {
        keys.push(account_key(Some(id), &input));
    }

    let mut conn = redis.get().await?;
    let removed: usize = conn.del(&keys).await?;
    Ok(removed)
}
