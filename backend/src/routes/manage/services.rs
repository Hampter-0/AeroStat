use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::activity;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::services::checker::{CHECK_TYPES, DNS_RECORD_TYPES};
use crate::state::AppState;

const PERMISSION: &str = "services";
const MIN_INTERVAL: i32 = 30;
const MAX_INTERVAL: i32 = 86_400;
const MAX_CERT_DAYS: i32 = 90;

#[derive(Serialize, sqlx::FromRow)]
pub struct GroupRow {
    id: String,
    name: String,
    sort_order: i32,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ServiceRow {
    id: String,
    name: String,
    check_type: String,
    url: String,
    group_id: Option<String>,
    expected_status: Vec<i32>,
    keyword: Option<String>,
    keyword_absent: bool,
    dns_record_type: Option<String>,
    dns_expected: Option<String>,
    cert_warn_days: Option<i32>,
    cert_expires_at: Option<chrono::DateTime<chrono::Utc>>,
    check_interval_seconds: i32,
    sort_order: i32,
}

#[derive(Serialize)]
pub struct ServicesResponse {
    groups: Vec<GroupRow>,
    services: Vec<ServiceRow>,
}

#[derive(Deserialize)]
pub struct ServiceBody {
    name: String,
    #[serde(default = "default_check_type")]
    check_type: String,
    url: String,
    group_id: Option<String>,
    #[serde(default)]
    expected_status: Vec<i32>,
    #[serde(default)]
    keyword: Option<String>,
    #[serde(default)]
    keyword_absent: bool,
    #[serde(default)]
    dns_record_type: Option<String>,
    #[serde(default)]
    dns_expected: Option<String>,
    #[serde(default)]
    cert_warn_days: Option<i32>,
    check_interval_seconds: i32,
}

fn default_check_type() -> String {
    "http".to_string()
}

/// A service body after checking, with only the fields its type uses.
struct CleanService {
    name: String,
    check_type: String,
    url: String,
    expected_status: Vec<i32>,
    keyword: Option<String>,
    keyword_absent: bool,
    dns_record_type: Option<String>,
    dns_expected: Option<String>,
    cert_warn_days: Option<i32>,
}

#[derive(Deserialize)]
pub struct GroupBody {
    name: String,
}

#[derive(Deserialize)]
pub struct MoveBody {
    direction: String,
}

#[derive(Serialize)]
pub struct Created {
    id: String,
}

fn clean_name(name: &str) -> Result<String, ApiError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 100 {
        return Err(ApiError::BadRequest("Name must be 1-100 characters".into()));
    }
    Ok(name.to_string())
}

fn clean_url(url: &str) -> Result<String, ApiError> {
    let url = url.trim();
    let parsed = reqwest::Url::parse(url)
        .map_err(|_| ApiError::BadRequest("Enter a full URL, like https://example.com".into()))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(ApiError::BadRequest("The URL must start with http:// or https://".into()));
    }
    Ok(url.to_string())
}

/// "host:port" for a TCP check, like db.example.com:5432 or [2001:db8::1]:22.
fn clean_tcp_target(target: &str) -> Result<String, ApiError> {
    let target = target.trim();
    let invalid = || ApiError::BadRequest("Enter a host and port, like db.example.com:5432".into());
    let (host, port) = target.rsplit_once(':').ok_or_else(invalid)?;
    let port: u16 = port.parse().map_err(|_| invalid())?;
    let host_ok = !host.is_empty()
        && host.len() <= 253
        && !host.contains('/')
        && !host.contains(char::is_whitespace)
        && (!host.contains(':') || (host.starts_with('[') && host.ends_with(']')));
    if port == 0 || !host_ok {
        return Err(invalid());
    }
    Ok(target.to_string())
}

/// A domain name for a DNS check, without http:// or a path.
fn clean_dns_name(name: &str) -> Result<String, ApiError> {
    let name = name.trim().trim_end_matches('.').to_lowercase();
    let valid = !name.is_empty()
        && name.len() <= 253
        && name.contains('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
        && name.split('.').all(|label| !label.is_empty() && label.len() <= 63);
    if !valid {
        return Err(ApiError::BadRequest("Enter a domain name, like example.com".into()));
    }
    Ok(name)
}

fn clean_text(value: Option<String>, max: usize, what: &str) -> Result<Option<String>, ApiError> {
    let Some(value) = value.map(|text| text.trim().to_string()).filter(|text| !text.is_empty()) else {
        return Ok(None);
    };
    if value.chars().count() > max {
        return Err(ApiError::BadRequest(format!("The {what} can be at most {max} characters")));
    }
    Ok(Some(value))
}

fn clean_service(body: ServiceBody) -> Result<CleanService, ApiError> {
    let name = clean_name(&body.name)?;
    let check_type = body.check_type.trim().to_lowercase();
    if !CHECK_TYPES.contains(&check_type.as_str()) {
        return Err(ApiError::BadRequest("Pick HTTP, TCP or DNS as the check type".into()));
    }
    check_interval(body.check_interval_seconds)?;

    let mut clean = CleanService {
        name,
        check_type: check_type.clone(),
        url: String::new(),
        expected_status: vec![200],
        keyword: None,
        keyword_absent: false,
        dns_record_type: None,
        dns_expected: None,
        cert_warn_days: None,
    };
    if check_type == "tcp" {
        clean.url = clean_tcp_target(&body.url)?;
    } else if check_type == "dns" {
        clean.url = clean_dns_name(&body.url)?;
        let record = body.dns_record_type.unwrap_or_else(|| "A".to_string()).trim().to_uppercase();
        if !DNS_RECORD_TYPES.contains(&record.as_str()) {
            return Err(ApiError::BadRequest("Pick A, AAAA, CNAME, MX or TXT as the record type".into()));
        }
        clean.dns_record_type = Some(record);
        clean.dns_expected = clean_text(body.dns_expected, 255, "expected value")?;
    } else {
        clean.url = clean_url(&body.url)?;
        clean.expected_status = clean_statuses(&body.expected_status)?;
        clean.keyword = clean_text(body.keyword, 200, "keyword")?;
        clean.keyword_absent = clean.keyword.is_some() && body.keyword_absent;
        if clean.url.to_lowercase().starts_with("https://") {
            if let Some(days) = body.cert_warn_days {
                if !(1..=MAX_CERT_DAYS).contains(&days) {
                    return Err(ApiError::BadRequest(format!(
                        "Warn between 1 and {MAX_CERT_DAYS} days before the certificate runs out"
                    )));
                }
                clean.cert_warn_days = Some(days);
            }
        }
    }
    Ok(clean)
}

fn clean_statuses(statuses: &[i32]) -> Result<Vec<i32>, ApiError> {
    let mut cleaned: Vec<i32> = Vec::new();
    for status in statuses {
        if !(100..=599).contains(status) {
            return Err(ApiError::BadRequest(format!("{status} is not a valid HTTP status code")));
        }
        if !cleaned.contains(status) {
            cleaned.push(*status);
        }
    }
    if cleaned.is_empty() {
        return Err(ApiError::BadRequest("Add at least one expected status code".into()));
    }
    cleaned.sort();
    Ok(cleaned)
}

fn check_interval(seconds: i32) -> Result<(), ApiError> {
    if !(MIN_INTERVAL..=MAX_INTERVAL).contains(&seconds) {
        return Err(ApiError::BadRequest(format!(
            "Check interval must be between {MIN_INTERVAL} seconds and 24 hours"
        )));
    }
    Ok(())
}

fn check_direction(direction: &str) -> Result<(), ApiError> {
    if direction == "up" || direction == "down" {
        return Ok(());
    }
    Err(ApiError::BadRequest("Direction must be 'up' or 'down'".into()))
}

/// Turns a name into a URL-safe id, e.g. "Main Website!" -> "main-website".
fn slugify(name: &str) -> String {
    let mut slug = String::new();
    for c in name.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
    }
    slug.trim_end_matches('-').to_string()
}

/// Picks a free id in `table`, adding -2, -3, … when the slug is taken.
async fn unique_id(db: &PgPool, table: &str, name: &str, fallback: &str) -> Result<String, ApiError> {
    let mut base = slugify(name);
    if base.is_empty() {
        base = fallback.to_string();
    }
    let query = format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE id = $1)");
    let mut candidate = base.clone();
    let mut counter = 2;
    loop {
        let (taken,): (bool,) = sqlx::query_as(&query).bind(&candidate).fetch_one(db).await?;
        if !taken {
            return Ok(candidate);
        }
        candidate = format!("{base}-{counter}");
        counter += 1;
    }
}

async fn check_group(db: &PgPool, group_id: &Option<String>) -> Result<(), ApiError> {
    if let Some(id) = group_id {
        let (exists,): (bool,) = sqlx::query_as("SELECT EXISTS(SELECT 1 FROM groups WHERE id = $1)")
            .bind(id)
            .fetch_one(db)
            .await?;
        if !exists {
            return Err(ApiError::BadRequest("That group doesn't exist".into()));
        }
    }
    Ok(())
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<ServicesResponse>, ApiError> {
    user.require("services.view")?;
    let groups: Vec<GroupRow> = sqlx::query_as("SELECT id, name, sort_order FROM groups ORDER BY sort_order, name")
        .fetch_all(&state.db)
        .await?;
    let services: Vec<ServiceRow> = sqlx::query_as(
        r#"
        SELECT id, name, check_type, url, group_id, expected_status, keyword, keyword_absent, dns_record_type,
               dns_expected, cert_warn_days, cert_expires_at, check_interval_seconds, sort_order
        FROM services ORDER BY sort_order, name
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(ServicesResponse { groups, services }))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<ServiceBody>,
) -> Result<(StatusCode, Json<Created>), ApiError> {
    user.require("services.create")?;
    let group_id = body.group_id.clone();
    let interval = body.check_interval_seconds;
    let service = clean_service(body)?;
    check_group(&state.db, &group_id).await?;
    let name = service.name.clone();

    let id = unique_id(&state.db, "services", &name, "service").await?;
    sqlx::query(
        r#"
        INSERT INTO services (id, name, check_type, url, group_id, expected_status, keyword, keyword_absent,
            dns_record_type, dns_expected, cert_warn_days, check_interval_seconds, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM services WHERE group_id IS NOT DISTINCT FROM $5))
        "#,
    )
    .bind(&id)
    .bind(&service.name)
    .bind(&service.check_type)
    .bind(&service.url)
    .bind(&group_id)
    .bind(&service.expected_status)
    .bind(&service.keyword)
    .bind(service.keyword_absent)
    .bind(&service.dns_record_type)
    .bind(&service.dns_expected)
    .bind(service.cert_warn_days)
    .bind(interval)
    .execute(&state.db)
    .await?;

    let details = activity::created(activity::snapshot(&state.db, "services", &id).await);
    activity::record(&state.db, &user, PERMISSION, "added service", Some(id.clone()), &name, details).await;
    Ok((StatusCode::CREATED, Json(Created { id })))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    Json(body): Json<ServiceBody>,
) -> Result<StatusCode, ApiError> {
    user.require("services.edit")?;
    let group_id = body.group_id.clone();
    let interval = body.check_interval_seconds;
    let service = clean_service(body)?;
    check_group(&state.db, &group_id).await?;
    let name = service.name.clone();
    let before = activity::snapshot(&state.db, "services", &id).await;

    // A new address or type means the stored certificate date may be wrong,
    // so it is read again on the next check.
    let updated = sqlx::query(
        r#"
        UPDATE services
        SET name = $1, check_type = $2, url = $3, group_id = $4, expected_status = $5, keyword = $6,
            keyword_absent = $7, dns_record_type = $8, dns_expected = $9, cert_warn_days = $10,
            check_interval_seconds = $11, next_check_at = now(),
            cert_checked_at = CASE WHEN url = $3 AND check_type = $2 THEN cert_checked_at END,
            cert_expires_at = CASE WHEN url = $3 AND check_type = $2 THEN cert_expires_at END,
            cert_warned_for = CASE WHEN url = $3 AND check_type = $2 THEN cert_warned_for END
        WHERE id = $12
        "#,
    )
    .bind(&service.name)
    .bind(&service.check_type)
    .bind(&service.url)
    .bind(&group_id)
    .bind(&service.expected_status)
    .bind(&service.keyword)
    .bind(service.keyword_absent)
    .bind(&service.dns_record_type)
    .bind(&service.dns_expected)
    .bind(service.cert_warn_days)
    .bind(interval)
    .bind(&id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if updated == 0 {
        return Err(ApiError::NotFound);
    }
    let details = activity::changes(before, activity::snapshot(&state.db, "services", &id).await);
    activity::record(&state.db, &user, PERMISSION, "edited service", Some(id), &name, details).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    user.require("services.delete")?;

    let before = activity::snapshot(&state.db, "services", &id).await;
    let mut tx = state.db.begin().await?;
    let deleted: Option<(String,)> = sqlx::query_as("DELETE FROM services WHERE id = $1 RETURNING name")
        .bind(&id)
        .fetch_optional(&mut *tx)
        .await?;
    let (name,) = deleted.ok_or(ApiError::NotFound)?;
    sqlx::query("UPDATE incidents SET affected_services = array_remove(affected_services, $1) WHERE $1 = ANY(affected_services)")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE maintenance SET affected_services = array_remove(affected_services, $1) WHERE $1 = ANY(affected_services)")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    activity::record(&state.db, &user, PERMISSION, "deleted service", None, &name, activity::deleted(before)).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn move_service(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    Json(body): Json<MoveBody>,
) -> Result<StatusCode, ApiError> {
    user.require("services.edit")?;
    check_direction(&body.direction)?;

    let row: Option<(Option<String>,)> = sqlx::query_as("SELECT group_id FROM services WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    let (group_id,) = row.ok_or(ApiError::NotFound)?;

    let siblings: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM services WHERE group_id IS NOT DISTINCT FROM $1 ORDER BY sort_order, name",
    )
    .bind(&group_id)
    .fetch_all(&state.db)
    .await?;
    let ids: Vec<String> = siblings.into_iter().map(|(id,)| id).collect();

    save_order(&state.db, "services", reorder(ids, &id, &body.direction)).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn check_now(State(state): State<AppState>, user: CurrentUser) -> Result<StatusCode, ApiError> {
    user.require("services.check")?;
    let result = sqlx::query("UPDATE services SET next_check_at = now()")
        .execute(&state.db)
        .await?;
    let details = serde_json::json!({ "services": result.rows_affected() });
    activity::record(&state.db, &user, PERMISSION, "checked all services now", None, "", Some(details)).await;
    Ok(StatusCode::ACCEPTED)
}

pub async fn create_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<GroupBody>,
) -> Result<(StatusCode, Json<Created>), ApiError> {
    user.require("groups.create")?;
    let name = clean_name(&body.name)?;
    let id = unique_id(&state.db, "groups", &name, "group").await?;

    sqlx::query(
        "INSERT INTO groups (id, name, sort_order) VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM groups))",
    )
    .bind(&id)
    .bind(&name)
    .execute(&state.db)
    .await?;

    let details = activity::created(activity::snapshot(&state.db, "groups", &id).await);
    activity::record(&state.db, &user, "groups", "added group", None, &name, details).await;
    Ok((StatusCode::CREATED, Json(Created { id })))
}

pub async fn update_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    Json(body): Json<GroupBody>,
) -> Result<StatusCode, ApiError> {
    user.require("groups.edit")?;
    let name = clean_name(&body.name)?;
    let before = activity::snapshot(&state.db, "groups", &id).await;
    let updated = sqlx::query("UPDATE groups SET name = $1 WHERE id = $2")
        .bind(&name)
        .bind(&id)
        .execute(&state.db)
        .await?
        .rows_affected();
    if updated == 0 {
        return Err(ApiError::NotFound);
    }
    let details = activity::changes(before, activity::snapshot(&state.db, "groups", &id).await);
    activity::record(&state.db, &user, "groups", "renamed group", None, &name, details).await;
    Ok(StatusCode::NO_CONTENT)
}

/// Services in the group are kept; they move to "Other" (group_id becomes NULL).
pub async fn delete_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    user.require("groups.delete")?;
    let before = activity::snapshot(&state.db, "groups", &id).await;
    let deleted: Option<(String,)> = sqlx::query_as("DELETE FROM groups WHERE id = $1 RETURNING name")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    let (name,) = deleted.ok_or(ApiError::NotFound)?;
    activity::record(&state.db, &user, "groups", "deleted group", None, &name, activity::deleted(before)).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn move_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    Json(body): Json<MoveBody>,
) -> Result<StatusCode, ApiError> {
    user.require("groups.edit")?;
    check_direction(&body.direction)?;

    let rows: Vec<(String,)> = sqlx::query_as("SELECT id FROM groups ORDER BY sort_order, name")
        .fetch_all(&state.db)
        .await?;
    let ids: Vec<String> = rows.into_iter().map(|(id,)| id).collect();
    if !ids.contains(&id) {
        return Err(ApiError::NotFound);
    }

    save_order(&state.db, "groups", reorder(ids, &id, &body.direction)).await?;
    Ok(StatusCode::NO_CONTENT)
}

fn reorder(mut ids: Vec<String>, id: &str, direction: &str) -> Vec<String> {
    if let Some(index) = ids.iter().position(|item| item == id) {
        if direction == "up" && index > 0 {
            ids.swap(index, index - 1);
        } else if direction == "down" && index + 1 < ids.len() {
            ids.swap(index, index + 1);
        }
    }
    ids
}

/// Rewrites sort_order as 0, 1, 2, … in the given order.
async fn save_order(db: &PgPool, table: &str, ids: Vec<String>) -> Result<(), ApiError> {
    let query = format!(
        "UPDATE {table} t SET sort_order = o.position - 1 FROM unnest($1::text[]) WITH ORDINALITY AS o(id, position) WHERE t.id = o.id"
    );
    sqlx::query(&query).bind(&ids).execute(db).await?;
    Ok(())
}
