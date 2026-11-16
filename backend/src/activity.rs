use serde_json::{json, Map, Value};
use sqlx::PgPool;

use crate::auth::CurrentUser;

/// Every category; admins see all of them. Other users only see the
/// categories that match their permissions.
pub const CATEGORIES: [&str; 9] = [
    "incidents",
    "maintenance",
    "services",
    "groups",
    "settings",
    "system",
    "users",
    "roles",
    "account",
];

/// Columns that change on their own and would only add noise to a diff.
const IGNORED_FIELDS: [&str; 2] = ["next_check_at", "updated_at"];

/// Writes one line to the activity log. A failed write is logged but never
/// fails the action itself.
pub async fn record(
    db: &PgPool,
    user: &CurrentUser,
    category: &str,
    action: &str,
    target_id: Option<String>,
    target_label: &str,
    details: Option<Value>,
) {
    let result = sqlx::query(
        r#"
        INSERT INTO activity_log (user_id, username, category, action, target_id, target_label, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        "#,
    )
    .bind(user.id)
    .bind(&user.username)
    .bind(category)
    .bind(action)
    .bind(target_id)
    .bind(Some(target_label).filter(|label| !label.is_empty()))
    .bind(details.map(|value| value.to_string()))
    .execute(db)
    .await;
    if let Err(e) = result {
        tracing::error!("Could not write to the activity log: {e}");
    }
}

/// Sign-in related lines. These keep the IP and are only shown to admins.
pub async fn record_account(
    db: &PgPool,
    user_id: Option<i64>,
    username: &str,
    action: &str,
    ip: &str,
    details: Option<Value>,
) {
    let result = sqlx::query(
        r#"
        INSERT INTO activity_log (user_id, username, category, action, ip, details)
        VALUES ($1, $2, 'account', $3, $4, $5::jsonb)
        "#,
    )
    .bind(user_id)
    .bind(username)
    .bind(action)
    .bind(ip)
    .bind(details.map(|value| value.to_string()))
    .execute(db)
    .await;
    if let Err(e) = result {
        tracing::error!("Could not write to the activity log: {e}");
    }
}

/// The row as JSON, without password hashes or image data. `table` is always
/// a constant from the caller, never user input.
pub async fn snapshot(db: &PgPool, table: &str, id: &str) -> Option<Value> {
    let query = format!(
        "SELECT (to_jsonb(t) - 'password_hash' - 'avatar' - 'data')::text FROM {table} t WHERE t.id::text = $1"
    );
    let row: Option<(String,)> = match sqlx::query_as(&query).bind(id).fetch_optional(db).await {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("Could not read {table} for the activity log: {e}");
            None
        }
    };
    row.and_then(|(text,)| serde_json::from_str(&text).ok())
}

pub fn created(snapshot: Option<Value>) -> Option<Value> {
    snapshot.map(|value| json!({ "created": value }))
}

pub fn deleted(snapshot: Option<Value>) -> Option<Value> {
    snapshot.map(|value| json!({ "deleted": value }))
}

/// `{ "changes": { field: { "from": …, "to": … } } }` for every field that
/// differs, or None when nothing changed.
pub fn changes(before: Option<Value>, after: Option<Value>) -> Option<Value> {
    let (Some(Value::Object(before)), Some(Value::Object(after))) = (before, after) else {
        return None;
    };
    let mut changed = Map::new();
    for (key, new) in after {
        if IGNORED_FIELDS.contains(&key.as_str()) {
            continue;
        }
        let old = before.get(&key).cloned().unwrap_or(Value::Null);
        if old != new {
            changed.insert(key, json!({ "from": old, "to": new }));
        }
    }
    if changed.is_empty() {
        return None;
    }
    Some(json!({ "changes": changed }))
}

pub async fn cleanup(db: &PgPool, days: i32) -> Result<u64, sqlx::Error> {
    let result = sqlx::query("DELETE FROM activity_log WHERE created_at < now() - make_interval(days => $1)")
        .bind(days)
        .execute(db)
        .await?;
    Ok(result.rows_affected())
}
