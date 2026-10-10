use sqlx::PgPool;

use crate::models::CheckResult;

pub async fn record(pool: &PgPool, result: &CheckResult) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO metrics (service_id, status, response_time, status_code)
        VALUES ($1, $2, $3, $4)
        "#,
        result.service_id,
        result.status,
        result.response_time_ms,
        result.status_code
    )
    .execute(pool)
    .await?;

    Ok(())
}