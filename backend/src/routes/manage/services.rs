use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::activity;
use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::state::AppState;

const PERMISSION: &str = "services";
const MIN_INTERVAL: i32 = 30;
const MAX_INTERVAL: i32 = 86_400;

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
    url: String,
    group_id: Option<String>,
    expected_status: Vec<i32>,
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
    url: String,
    group_id: Option<String>,
    expected_status: Vec<i32>,
    check_interval_seconds: i32,
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
        SELECT id, name, url, group_id, expected_status, check_interval_seconds, sort_order
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
    let name = clean_name(&body.name)?;
    let url = clean_url(&body.url)?;
    let statuses = clean_statuses(&body.expected_status)?;
    check_interval(body.check_interval_seconds)?;
    check_group(&state.db, &body.group_id).await?;

    let id = unique_id(&state.db, "services", &name, "service").await?;
    sqlx::query(
        r#"
        INSERT INTO services (id, name, url, group_id, expected_status, check_interval_seconds, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6,
            (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM services WHERE group_id IS NOT DISTINCT FROM $4))
        "#,
    )
    .bind(&id)
    .bind(&name)
    .bind(&url)
    .bind(&body.group_id)
    .bind(&statuses)
    .bind(body.check_interval_seconds)
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
    let name = clean_name(&body.name)?;
    let url = clean_url(&body.url)?;
    let statuses = clean_statuses(&body.expected_status)?;
    check_interval(body.check_interval_seconds)?;
    check_group(&state.db, &body.group_id).await?;
    let before = activity::snapshot(&state.db, "services", &id).await;

    let updated = sqlx::query(
        r#"
        UPDATE services
        SET name = $1, url = $2, group_id = $3, expected_status = $4, check_interval_seconds = $5,
            next_check_at = now()
        WHERE id = $6
        "#,
    )
    .bind(&name)
    .bind(&url)
    .bind(&body.group_id)
    .bind(&statuses)
    .bind(body.check_interval_seconds)
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
    sqlx::query("UPDATE services SET next_check_at = now()")
        .execute(&state.db)
        .await?;
    activity::record(&state.db, &user, PERMISSION, "checked all services now", None, "", None).await;
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
