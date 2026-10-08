use std::env;

#[derive(Debug, Clone)]
pub struct Settings {
    pub port: u16,
    pub database_url: String,
}

impl Settings {
    pub fn load() -> anyhow::Result<Self> {
        let port = env::var("PORT")
            .unwrap_or_else(|_| "3004".into())
            .parse()?;

        let database_url = env::var("DATABASE_URL")?;

        Ok(Self { port, database_url })
    }
}