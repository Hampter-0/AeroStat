use axum::{extract::State, Json};

use crate::state::AppState;

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct ServiceStatus {
    id: String,
    name: String,
    url: String,
    group_id: Option<String>,
    status: Option<String>,
    response_time_ms: Option<i32>,
    checked_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn get(State(state): State<AppState>) -> Json<Vec<ServiceStatus>> {
    let rows: Vec<ServiceStatus> = sqlx::query_as(
        r#"
        SELECT
            s.id,
            s.name,
            s.url,
            s.group_id,
            m.status,
            m.response_time AS response_time_ms,
            m.checked_at
        FROM services s
        LEFT JOIN LATERAL (
            SELECT status, response_time, checked_at
            FROM metrics
            WHERE metrics.service_id = s.id
            ORDER BY checked_at DESC
            LIMIT 1
        ) m ON true
        ORDER BY s.sort_order
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(rows)
}