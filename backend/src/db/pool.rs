use sqlx::migrate::Migrator;
use sqlx::postgres::{PgPool, PgPoolOptions};

/// The migrations built into this binary.
pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Opens a connection pool. Does not run migrations — call `migrate`
/// separately once you have a pool.
pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    Ok(pool)
}

/// Runs all pending migrations from `backend/migrations`.
pub async fn migrate(pool: &PgPool) -> anyhow::Result<()> {
    MIGRATOR.run(pool).await?;
    Ok(())
}