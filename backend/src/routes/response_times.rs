//! Average response times for the graph on the status page.

use axum::{extract::Query, extract::State, Json};
use chrono::{DateTime, Duration, Utc};
use deadpool_redis::redis::AsyncCommands;
use serde::{Deserialize, Serialize};

use crate::state::AppState;

const CACHE_SECONDS: u64 = 60;

#[derive(Deserialize)]
pub struct RangeQuery {
    range: Option<String>,
    service: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ResponseTimes {
    range: String,
    bucket_seconds: i64,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    points: Vec<Point>,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Point {
    t: DateTime<Utc>,
    ms: i32,
}

/// How far back a range looks and how wide one point is: about 300 points
/// per range, enough for a detailed line without sending too much.
fn range_spec(range: &str) -> (&'static str, Duration, i64) {
    match range {
        "week" => ("week", Duration::days(7), 30 * 60),
        "month" => ("month", Duration::days(30), 2 * 60 * 60),
        _ => ("day", Duration::hours(24), 5 * 60),
    }
}

/// Average response time per time slot. Only checks that were up count,
/// a timeout says nothing about speed. Public, so it is cached for a minute.
pub async fn get(State(state): State<AppState>, Query(query): Query<RangeQuery>) -> Json<ResponseTimes> {
    let (range, span, bucket) = range_spec(query.range.as_deref().unwrap_or("day"));
    let service = query.service.filter(|id| !id.is_empty() && id.len() <= 100);
    let key = format!("response-times:{range}:{}", service.as_deref().unwrap_or("all"));

    if let Ok(mut conn) = state.redis.get().await {
        let cached: Option<String> = conn.get(&key).await.unwrap_or(None);
        if let Some(text) = cached {
            if let Ok(value) = serde_json::from_str::<ResponseTimes>(&text) {
                return Json(value);
            }
        }
    }

    let to = Utc::now();
    let from = to - span;
    let points: Vec<Point> = sqlx::query_as(
        r#"
        SELECT to_timestamp(floor(extract(epoch FROM m.checked_at) / $3) * $3) AS t,
               ROUND(AVG(m.response_time))::int AS ms
        FROM services s
        JOIN metrics m ON m.service_id = s.id AND m.checked_at >= $1
        WHERE m.status = 'online'
          AND ($2::text IS NULL OR s.id = $2)
        GROUP BY 1
        ORDER BY 1
        "#,
    )
    .bind(from)
    .bind(service.as_deref())
    .bind(bucket as f64)
    .fetch_all(&state.db)
    .await
    .unwrap_or_else(|e| {
        tracing::error!("Response times for the status page failed: {e}");
        Vec::new()
    });

    let result = ResponseTimes {
        range: range.to_string(),
        bucket_seconds: bucket,
        from,
        to,
        points,
    };
    if let (Ok(mut conn), Ok(text)) = (state.redis.get().await, serde_json::to_string(&result)) {
        let _: Result<(), _> = conn.set_ex(&key, text, CACHE_SECONDS).await;
    }
    Json(result)
}
