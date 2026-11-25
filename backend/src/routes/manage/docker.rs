//! Docker hosts for container checks, and the containers on one, for the
//! picker in the service form.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::activity;
use crate::auth::CurrentUser;
use crate::docker;
use crate::error::ApiError;
use crate::state::AppState;

const PERMISSION: &str = "settings.docker";

#[derive(Serialize, sqlx::FromRow)]
pub struct HostRow {
    id: i64,
    name: String,
    address: String,
    services: i64,
}

#[derive(Serialize)]
pub struct HostsResponse {
    /// Where checks without a chosen host look: DOCKER_HOST or the socket.
    default_address: String,
    hosts: Vec<HostRow>,
}

#[derive(Deserialize)]
pub struct HostBody {
    name: String,
    address: String,
}

#[derive(Deserialize)]
pub struct ContainersQuery {
    host: Option<i64>,
}

#[derive(Serialize)]
pub struct ContainersResponse {
    address: String,
    containers: Vec<docker::Container>,
}

#[derive(Serialize)]
pub struct Created {
    id: i64,
}

fn may_view(user: &CurrentUser) -> Result<(), ApiError> {
    if ["services.view", PERMISSION].iter().any(|permission| user.has(permission)) {
        Ok(())
    } else {
        Err(ApiError::Forbidden)
    }
}

fn clean(body: &HostBody) -> Result<(String, String), ApiError> {
    let name = body.name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(ApiError::BadRequest("Name must be 1-60 characters".into()));
    }
    let address = docker::normalize(&body.address).ok_or_else(|| {
        ApiError::BadRequest("Enter an address like http://192.168.1.20:2375, tcp://server:2375 or unix:///var/run/docker.sock".into())
    })?;
    Ok((name.to_string(), address))
}

async fn host_address(state: &AppState, host: Option<i64>) -> Result<String, ApiError> {
    let Some(id) = host else {
        return Ok(docker::default_address());
    };
    let address: Option<String> = sqlx::query_scalar("SELECT address FROM docker_hosts WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?;
    address.ok_or(ApiError::NotFound)
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<HostsResponse>, ApiError> {
    may_view(&user)?;
    let hosts: Vec<HostRow> = sqlx::query_as(
        r#"
        SELECT h.id, h.name, h.address, (SELECT COUNT(*) FROM services s WHERE s.docker_host_id = h.id) AS services
        FROM docker_hosts h ORDER BY h.name
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(HostsResponse { default_address: docker::default_address(), hosts }))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<HostBody>,
) -> Result<(StatusCode, Json<Created>), ApiError> {
    user.require(PERMISSION)?;
    let (name, address) = clean(&body)?;
    let id: i64 = sqlx::query_scalar("INSERT INTO docker_hosts (name, address) VALUES ($1, $2) RETURNING id")
        .bind(&name)
        .bind(&address)
        .fetch_one(&state.db)
        .await?;
    let details = serde_json::json!({ "address": address });
    activity::record(&state.db, &user, "settings", "added Docker host", Some(id.to_string()), &name, Some(details)).await;
    Ok((StatusCode::CREATED, Json(Created { id })))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<HostBody>,
) -> Result<StatusCode, ApiError> {
    user.require(PERMISSION)?;
    let (name, address) = clean(&body)?;
    let updated = sqlx::query("UPDATE docker_hosts SET name = $1, address = $2 WHERE id = $3")
        .bind(&name)
        .bind(&address)
        .bind(id)
        .execute(&state.db)
        .await?
        .rows_affected();
    if updated == 0 {
        return Err(ApiError::NotFound);
    }
    let details = serde_json::json!({ "address": address });
    activity::record(&state.db, &user, "settings", "changed Docker host", Some(id.to_string()), &name, Some(details)).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete(State(state): State<AppState>, user: CurrentUser, Path(id): Path<i64>) -> Result<StatusCode, ApiError> {
    user.require(PERMISSION)?;
    let used: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM services WHERE docker_host_id = $1")
        .bind(id)
        .fetch_one(&state.db)
        .await?;
    if used > 0 {
        let what = if used == 1 { "1 service uses".to_string() } else { format!("{used} services use") };
        return Err(ApiError::Conflict(format!("{what} this Docker host. Change or delete them first.")));
    }
    let name: Option<String> = sqlx::query_scalar("DELETE FROM docker_hosts WHERE id = $1 RETURNING name")
        .bind(id)
        .fetch_optional(&state.db)
        .await?;
    let Some(name) = name else {
        return Err(ApiError::NotFound);
    };
    activity::record(&state.db, &user, "settings", "deleted Docker host", Some(id.to_string()), &name, None).await;
    Ok(StatusCode::NO_CONTENT)
}

/// The containers on a host, also used to test whether the host is reachable.
pub async fn containers(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(query): Query<ContainersQuery>,
) -> Result<Json<ContainersResponse>, ApiError> {
    if !["services.create", "services.edit", PERMISSION].iter().any(|permission| user.has(permission)) {
        return Err(ApiError::Forbidden);
    }
    let address = host_address(&state, query.host).await?;
    let containers = docker::list(&address).await.map_err(ApiError::BadRequest)?;
    Ok(Json(ContainersResponse { address, containers }))
}
