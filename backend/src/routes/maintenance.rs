use axum::{extract::State, Json};

use crate::models::Maintenance;
use crate::state::AppState;

pub async fn list(State(state): State<AppState>) -> Json<Vec<Maintenance>> {
    let rows: Vec<Maintenance> = sqlx::query_as(
        r#"
        SELECT
            id,
            title,
            description,
            CASE
                WHEN status = 'cancelled' THEN 'cancelled'
                WHEN now() < scheduled_start THEN 'scheduled'
                WHEN now() < scheduled_end THEN 'in_progress'
                ELSE 'completed'
            END AS status,
            affected_services,
            scheduled_start,
            scheduled_end,
            created_at
        FROM maintenance
        ORDER BY scheduled_start DESC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}