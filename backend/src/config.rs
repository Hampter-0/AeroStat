use std::env;

use crate::login_guard::LoginLimits;

#[derive(Debug, Clone)]
pub struct Settings {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub metrics_retention_days: i32,
    pub login_limits: LoginLimits,
    pub session_days: i32,
    pub update_check: bool,
}

impl Settings {
    pub fn load() -> anyhow::Result<Self> {
        let host = env::var("HOST")
            .map(|host| host.trim().to_string())
            .ok()
            .filter(|host| !host.is_empty())
            .unwrap_or_else(|| "0.0.0.0".into());
        let port = env::var("PORT").unwrap_or_else(|_| "3004".into()).parse()?;

        let database_url = env::var("DATABASE_URL")?;
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());

        let metrics_retention_days = env::var("METRICS_RETENTION_DAYS")
            .unwrap_or_else(|_| "60".into())
            .parse()?;

        let login_limits = LoginLimits {
            per_ip: positive("LOGIN_MAX_FAILURES_PER_IP", 10)?,
            per_account: positive("LOGIN_MAX_FAILURES_PER_ACCOUNT", 30)?,
            lockout_minutes: positive("LOGIN_LOCKOUT_MINUTES", 15)?,
        };

        let session_days = positive("SESSION_DAYS", 30)?;
        if session_days > 365 {
            anyhow::bail!("SESSION_DAYS can be at most 365");
        }

        // On unless explicitly turned off.
        let update_check = !matches!(
            env::var("UPDATE_CHECK").unwrap_or_default().trim().to_lowercase().as_str(),
            "false" | "0" | "no" | "off"
        );

        Ok(Self {
            host,
            port,
            database_url,
            redis_url,
            metrics_retention_days,
            login_limits,
            session_days: session_days as i32,
            update_check,
        })
    }
}

fn positive(name: &str, default: i64) -> anyhow::Result<i64> {
    let value: i64 = match env::var(name) {
        Ok(text) => text
            .trim()
            .parse()
            .map_err(|_| anyhow::anyhow!("{name} must be a whole number"))?,
        Err(_) => default,
    };
    if value < 1 {
        anyhow::bail!("{name} must be at least 1");
    }
    Ok(value)
}