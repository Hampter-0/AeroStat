use axum::http::HeaderMap;
use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::Pool;
use sqlx::PgPool;

use crate::error::ApiError;

/// Set with LOGIN_MAX_FAILURES_PER_IP, LOGIN_MAX_FAILURES_PER_ACCOUNT and
/// LOGIN_LOCKOUT_MINUTES. The account limit caps guessing from many addresses.
/// It doesn't apply to IPs the account already signed in from, so strangers
/// can't lock the owner out.
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

/// The counters that apply to this attempt. The account counter is left out for
/// an IP the account already signed in from.
fn limits(config: &LoginLimits, ip: &str, account: Option<&str>) -> Vec<(String, i64)> {
    let mut list = vec![(ip_key(ip), config.per_ip)];
    if let Some(account) = account {
        list.push((account.to_string(), config.per_account));
    }
    list
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

fn blocked_error(seconds: i64, what: &str) -> ApiError {
    let minutes = ((seconds + 59) / 60).max(1);
    let unit = if minutes == 1 { "minute" } else { "minutes" };
    ApiError::TooManyRequests(format!("Too many {what}. Try again in {minutes} {unit}."))
}

/// Adds one to a counter and gives a new counter its lifetime in the same
/// round trip, so a counter can never be left without an expiry.
async fn bump(conn: &mut deadpool_redis::Connection, key: &str, seconds: i64) -> anyhow::Result<i64> {
    let (count,): (i64,) = deadpool_redis::redis::pipe()
        .atomic()
        .cmd("SET")
        .arg(key)
        .arg(0)
        .arg("EX")
        .arg(seconds)
        .arg("NX")
        .ignore()
        .incr(key, 1)
        .query_async(&mut **conn)
        .await?;
    Ok(count)
}

/// Gives back one attempt, never going below zero.
async fn give_back(redis: &Pool, key: &str) {
    let result: anyhow::Result<()> = async {
        let mut conn = redis.get().await?;
        let count: Option<i64> = conn.get(key).await?;
        if count.unwrap_or(0) > 0 {
            conn.decr::<_, _, ()>(key, 1).await?;
        }
        Ok(())
    }
    .await;
    if let Err(e) = result {
        tracing::warn!("Could not give back a sign-in attempt: {e}");
    }
}

/// Counts a sign-in attempt before the password is checked, so many attempts
/// sent at once can't all get past the limit. Returns whether this attempt
/// reached a limit, so the caller can log the block once. If Redis is
/// unreachable, sign-in keeps working.
pub async fn reserve(redis: &Pool, config: &LoginLimits, ip: &str, account: Option<&str>) -> Result<bool, ApiError> {
    let result: anyhow::Result<(Option<i64>, bool)> = async {
        let mut conn = redis.get().await?;
        let mut over: Option<i64> = None;
        let mut reached = false;
        // The IP comes first. Once it is blocked the attempt stops there, so
        // one address can't push an account over its own limit.
        for (key, max) in limits(config, ip, account) {
            let count = bump(&mut conn, &key, config.lockout_minutes * 60).await?;
            if count > max {
                let ttl: i64 = conn.ttl(&key).await?;
                over = Some(ttl.max(1));
                break;
            } else if count == max {
                reached = true;
            }
        }
        Ok((over, reached))
    }
    .await;
    match result {
        Ok((Some(seconds), _)) => Err(blocked_error(seconds, "failed sign-in attempts")),
        Ok((None, reached)) => Ok(reached),
        Err(e) => {
            tracing::warn!("Login guard unavailable, allowing the attempt: {e}");
            Ok(false)
        }
    }
}

/// After a correct password the reserved IP attempt is given back.
pub async fn release_ip(redis: &Pool, ip: &str) {
    give_back(redis, &ip_key(ip)).await;
}

/// A counter for one account that only someone already past the password
/// (or signed in) can add to: wrong second-factor codes and wrong current
/// passwords. A correct password does not reset it.
pub async fn hit_user_limit(redis: &Pool, key: &str, max: i64, seconds: i64, what: &str) -> Result<(), ApiError> {
    let result: anyhow::Result<Option<i64>> = async {
        let mut conn = redis.get().await?;
        let count = bump(&mut conn, key, seconds).await?;
        if count > max {
            let ttl: i64 = conn.ttl(key).await?;
            return Ok(Some(ttl.max(1)));
        }
        Ok(None)
    }
    .await;
    match result {
        Ok(Some(seconds)) => Err(blocked_error(seconds, what)),
        Ok(None) => Ok(()),
        Err(e) => {
            tracing::warn!("Login guard unavailable, allowing the attempt: {e}");
            Ok(())
        }
    }
}

/// Undoes one hit_user_limit after the attempt turned out right.
pub async fn release_user_limit(redis: &Pool, key: &str) {
    give_back(redis, key).await;
}

/// Wrong current passwords per account before a short block.
const MAX_PASSWORD_CHECKS: i64 = 10;

/// Checks the current password for a change on the account, counting wrong
/// ones, so a stolen session can't be used to guess the password.
pub async fn verify_current_password(
    redis: &Pool,
    config: &LoginLimits,
    user_id: i64,
    password: String,
    hash: String,
) -> Result<(), ApiError> {
    let key = format!("password:fail:user:{user_id}");
    hit_user_limit(redis, &key, MAX_PASSWORD_CHECKS, config.lockout_minutes * 60, "wrong passwords").await?;
    if !crate::auth::verify_password(password, hash).await {
        return Err(ApiError::BadRequest("Your current password is not correct".into()));
    }
    release_user_limit(redis, &key).await;
    Ok(())
}

/// Refuses the attempt while this IP or account has too many recent failures.
/// If Redis is unreachable, sign-in keeps working.
pub async fn check(redis: &Pool, config: &LoginLimits, ip: &str, account: Option<&str>) -> Result<(), ApiError> {
    let blocked = match blocked_seconds(redis, config, ip, account).await {
        Ok(seconds) => seconds,
        Err(e) => {
            tracing::warn!("Login guard unavailable, allowing the attempt: {e}");
            None
        }
    };
    if let Some(seconds) = blocked {
        return Err(blocked_error(seconds, "failed sign-in attempts"));
    }
    Ok(())
}

async fn blocked_seconds(redis: &Pool, config: &LoginLimits, ip: &str, account: Option<&str>) -> anyhow::Result<Option<i64>> {
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
pub async fn record_failure(redis: &Pool, config: &LoginLimits, ip: &str, account: Option<&str>) -> bool {
    match count_failure(redis, config, ip, account).await {
        Ok(reached) => reached,
        Err(e) => {
            tracing::warn!("Could not count a failed sign-in: {e}");
            false
        }
    }
}

async fn count_failure(redis: &Pool, config: &LoginLimits, ip: &str, account: Option<&str>) -> anyhow::Result<bool> {
    let mut conn = redis.get().await?;
    let mut reached = false;
    for (key, max) in limits(config, ip, account) {
        let count = bump(&mut conn, &key, config.lockout_minutes * 60).await?;
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
