use std::env;

#[derive(Debug, Clone)]
pub struct Settings {
    pub port: u16,
    pub database_url: String,
    pub seed_on_startup: bool,
    pub metrics_retention_days: i32,
}

impl Settings {
    pub fn load() -> anyhow::Result<Self> {
        let port = env::var("PORT").unwrap_or_else(|_| "3004".into()).parse()?;

        let database_url = env::var("DATABASE_URL")?;

        let seed_on_startup = env::var("SEED_ON_STARTUP")
            .map(|v| v.eq_ignore_ascii_case("true"))
            .unwrap_or(true);

        let metrics_retention_days = env::var("METRICS_RETENTION_DAYS")
            .unwrap_or_else(|_| "90".into())
            .parse()?;

        Ok(Self {
            port,
            database_url,
            seed_on_startup,
            metrics_retention_days,
        })
    }
}