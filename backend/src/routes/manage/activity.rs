use axum::extract::{Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::activity::CATEGORIES;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::state::AppState;

const DEFAULT_PER_PAGE: i64 = 25;
const MAX_PER_PAGE: i64 = 100;

#[derive(Deserialize)]
pub struct ActivityQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    category: Option<String>,
    q: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ActivityRow {
    id: i64,
    user_id: Option<i64>,
    username: String,
    avatar_version: Option<i64>,
    category: String,
    action: String,
    target_id: Option<String>,
    target_label: Option<String>,
    ip: Option<String>,
    details: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ActivityEntry {
    id: i64,
    user_id: Option<i64>,
    username: String,
    avatar_version: Option<i64>,
    category: String,
    action: String,
    target_id: Option<String>,
    target_label: Option<String>,
    ip: Option<String>,
    details: Option<Value>,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ActivityResponse {
    entries: Vec<ActivityEntry>,
    total: i64,
    page: i64,
    per_page: i64,
}

/// Escapes LIKE wildcards so a search for "50%" means the literal text.
fn like_pattern(text: &str) -> String {
    let escaped = text.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{escaped}%")
}

/// Whether the user may see entries of this category, next to activity.view.
fn can_see(user: &CurrentUser, category: &str) -> bool {
    match category {
        "incidents" => user.has("incidents.view"),
        "maintenance" => user.has("maintenance.view"),
        "services" => user.has("services.view"),
        "settings" => user.has("settings.general") || user.has("settings.notifications") || user.has("system.email"),
        "users" | "account" => user.has("users.view") || user.has("roles.view"),
        _ => user.is_admin,
    }
}

/// Newest first, and only the categories the user can see elsewhere in the
/// panel; sign-ins and user changes need users.view or roles.view.
pub async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(query): Query<ActivityQuery>,
) -> Result<Json<ActivityResponse>, ApiError> {
    user.require("activity.view")?;
    let allowed: Vec<String> = CATEGORIES
        .iter()
        .filter(|category| can_see(&user, category))
        .map(|category| category.to_string())
        .collect();
    let categories: Vec<String> = match query.category.filter(|category| !category.is_empty()) {
        Some(category) => allowed.into_iter().filter(|item| *item == category).collect(),
        None => allowed,
    };
    let search = query
        .q
        .map(|q| q.trim().to_string())
        .filter(|q| !q.is_empty())
        .map(|q| like_pattern(&q));
    let per_page = query.per_page.unwrap_or(DEFAULT_PER_PAGE).clamp(1, MAX_PER_PAGE);
    let page = query.page.unwrap_or(1).max(1);

    let filter = r#"
        a.category = ANY($1)
        AND ($2::text IS NULL
            OR a.username ILIKE $2 OR a.action ILIKE $2 OR a.target_label ILIKE $2 OR a.ip ILIKE $2)
    "#;

    let (total,): (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) FROM activity_log a WHERE {filter}"))
        .bind(&categories)
        .bind(&search)
        .fetch_one(&state.db)
        .await?;

    let rows: Vec<ActivityRow> = sqlx::query_as(&format!(
        r#"
        SELECT a.id, a.user_id, a.username, EXTRACT(EPOCH FROM u.avatar_updated_at)::bigint AS avatar_version,
            a.category, a.action, a.target_id, a.target_label, a.ip, a.details::text AS details, a.created_at
        FROM activity_log a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE {filter}
        ORDER BY a.id DESC
        LIMIT $3 OFFSET $4
        "#
    ))
    .bind(&categories)
    .bind(&search)
    .bind(per_page)
    .bind((page - 1) * per_page)
    .fetch_all(&state.db)
    .await?;

    let entries = rows
        .into_iter()
        .map(|row| ActivityEntry {
            id: row.id,
            user_id: row.user_id,
            username: row.username,
            avatar_version: row.avatar_version,
            category: row.category,
            action: row.action,
            target_id: row.target_id,
            target_label: row.target_label,
            ip: row.ip,
            details: row.details.and_then(|text| serde_json::from_str(&text).ok()),
            created_at: row.created_at,
        })
        .collect();

    Ok(Json(ActivityResponse {
        entries,
        total,
        page,
        per_page,
    }))
}
