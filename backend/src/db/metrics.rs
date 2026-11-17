use sqlx::PgPool;

use crate::models::CheckResult;

pub async fn record(pool: &PgPool, result: &CheckResult) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO metrics (service_id, status, response_time, status_code, error)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(&result.service_id)
    .bind(&result.status)
    .bind(result.response_time_ms)
    .bind(result.status_code)
    .bind(&result.error)
    .execute(pool)
    .await?;

    Ok(())
}
