use sqlx::PgPool;

/// Deletes metrics older than `retention_days`. Returns the number of deleted rows.
pub async fn cleanup_old_metrics(pool: &PgPool, retention_days: i32) -> anyhow::Result<u64> {
    let result = sqlx::query!(
        "DELETE FROM metrics WHERE checked_at < now() - make_interval(days => $1)",
        retention_days
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}