use sqlx::PgPool;

use crate::models::ServicesConfig;

/// Reads a services.yml file and upserts its contents into the database.

pub async fn seed_from_file(pool: &PgPool, path: &str) -> anyhow::Result<()> {
    if !std::path::Path::new(path).exists() {
        tracing::warn!("{path} not found, skipping service seeding");
        return Ok(());
    }

    let contents = std::fs::read_to_string(path)?;
    let config: ServicesConfig = serde_yaml::from_str(&contents)?;

    for group in &config.groups {
        sqlx::query!(
            r#"
            INSERT INTO groups (id, name, sort_order)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                sort_order = EXCLUDED.sort_order
            "#,
            group.id,
            group.name,
            group.sort_order
        )
        .execute(pool)
        .await?;
    }

    for service in &config.services {
        sqlx::query!(
            r#"
            INSERT INTO services (id, name, url, type, group_id, expected_status, check_interval_seconds, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                url = EXCLUDED.url,
                type = EXCLUDED.type,
                group_id = EXCLUDED.group_id,
                expected_status = EXCLUDED.expected_status,
                check_interval_seconds = EXCLUDED.check_interval_seconds,
                sort_order = EXCLUDED.sort_order
            "#,
            service.id,
            service.name,
            service.url,
            service.r#type,
            service.group_id,
            &service.expected_status,
            service.check_interval_seconds,
            service.sort_order
        )
        .execute(pool)
        .await?;
    }

    tracing::info!(
        "Seeded {} group(s) and {} service(s) from {path}",
        config.groups.len(),
        config.services.len()
    );

    Ok(())
}
