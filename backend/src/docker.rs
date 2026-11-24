//! Talks to Docker's API, only to read: whether a container runs and which
//! containers there are. A host is the local socket, a socket proxy or a
//! remote Docker over HTTP.

use std::time::Duration;

use serde::Serialize;

const TIMEOUT: Duration = Duration::from_secs(10);

/// The Docker that checks without a chosen host use: DOCKER_HOST, or the
/// socket at its usual place.
pub fn default_address() -> String {
    match std::env::var("DOCKER_HOST") {
        Ok(value) if !value.trim().is_empty() => normalize(&value).unwrap_or(value),
        _ => "unix:///var/run/docker.sock".to_string(),
    }
}

/// "unix:///path", "/path", "http(s)://host:port" or "tcp://host:port"
/// (treated as http). None when it is none of those.
pub fn normalize(address: &str) -> Option<String> {
    let address = address.trim().trim_end_matches('/');
    if let Some(path) = address.strip_prefix("unix://") {
        return path.starts_with('/').then(|| format!("unix://{path}"));
    }
    if address.starts_with('/') {
        return Some(format!("unix://{address}"));
    }
    let web = match address.strip_prefix("tcp://") {
        Some(rest) => format!("http://{rest}"),
        None => address.to_string(),
    };
    let parsed = reqwest::Url::parse(&web).ok()?;
    let ok = matches!(parsed.scheme(), "http" | "https")
        && parsed.host_str().is_some()
        && parsed.path().trim_matches('/').is_empty()
        && parsed.query().is_none();
    ok.then_some(web)
}

#[derive(Serialize)]
pub struct Container {
    pub name: String,
    pub state: String,
    pub status: String,
    pub image: String,
}

/// Every container on the host, running or not, sorted by name.
pub async fn list(address: &str) -> Result<Vec<Container>, String> {
    let (status, body) = get(address, "/containers/json?all=1").await?;
    if status != 200 {
        return Err(format!("Docker answered with status {status}."));
    }
    let items: Vec<serde_json::Value> =
        serde_json::from_str(&body).map_err(|_| "Docker sent an answer that could not be read.".to_string())?;
    let mut containers: Vec<Container> = items
        .iter()
        .map(|item| Container {
            name: item["Names"][0].as_str().unwrap_or("").trim_start_matches('/').to_string(),
            state: item["State"].as_str().unwrap_or("").to_string(),
            status: item["Status"].as_str().unwrap_or("").to_string(),
            image: item["Image"].as_str().unwrap_or("").to_string(),
        })
        .filter(|container| !container.name.is_empty())
        .collect();
    containers.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(containers)
}

/// Up when the container runs and is not unhealthy.
pub async fn container_status(address: &str, name: &str) -> Result<(), String> {
    let (status, body) = get(address, &format!("/containers/{name}/json")).await?;
    if status == 404 {
        return Err(format!("There is no container called {name}."));
    }
    if status != 200 {
        return Err(format!("Docker answered with status {status}."));
    }
    let info: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| "Docker sent an answer that could not be read.".to_string())?;
    let state = &info["State"];
    if state["Running"].as_bool() != Some(true) {
        let reason = match state["Status"].as_str().unwrap_or("") {
            "exited" => format!("The container has stopped (exit code {}).", state["ExitCode"].as_i64().unwrap_or(0)),
            "created" => "The container was created but never started.".to_string(),
            "paused" => "The container is paused.".to_string(),
            "restarting" => "The container keeps restarting.".to_string(),
            "dead" => "The container is dead and has to be removed.".to_string(),
            _ => "The container is not running.".to_string(),
        };
        return Err(reason);
    }
    if state["Paused"].as_bool() == Some(true) {
        return Err("The container is paused.".to_string());
    }
    if state["Health"]["Status"].as_str() == Some("unhealthy") {
        return Err("The container is running but unhealthy.".to_string());
    }
    Ok(())
}

async fn get(address: &str, path: &str) -> Result<(u16, String), String> {
    match tokio::time::timeout(TIMEOUT, request(address, path)).await {
        Ok(result) => result,
        Err(_) => Err("Docker did not answer within 10 seconds.".to_string()),
    }
}

async fn request(address: &str, path: &str) -> Result<(u16, String), String> {
    if let Some(socket) = address.strip_prefix("unix://") {
        return unix_request(socket, path).await;
    }
    let client = reqwest::Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| format!("Could not reach Docker: {e}."))?;
    let response = client
        .get(format!("{address}{path}"))
        .send()
        .await
        .map_err(|_| {
            if address.contains("docker-proxy") {
                format!("Docker is not reachable at {address}. Start the proxy with: docker compose --profile docker up -d")
            } else {
                format!("Docker is not reachable at {address}.")
            }
        })?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| format!("Docker did not answer: {e}."))?;
    Ok((status, body))
}

#[cfg(unix)]
async fn unix_request(socket: &str, path: &str) -> Result<(u16, String), String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::UnixStream;

    const MAX_RESPONSE_BYTES: u64 = 4 * 1024 * 1024;

    let mut stream = UnixStream::connect(socket).await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            format!("The backend may not read the Docker socket {socket}. Use the Docker proxy instead.")
        } else {
            format!("The Docker socket {socket} is not available. Use the Docker proxy, or mount the socket.")
        }
    })?;
    let request = format!("GET {path} HTTP/1.0\r\nHost: docker\r\n\r\n");
    stream
        .write_all(request.as_bytes())
        .await
        .map_err(|e| format!("Docker did not answer: {e}."))?;
    let mut response = Vec::new();
    stream
        .take(MAX_RESPONSE_BYTES)
        .read_to_end(&mut response)
        .await
        .map_err(|e| format!("Docker did not answer: {e}."))?;
    let text = String::from_utf8_lossy(&response);
    let (head, body) = text.split_once("\r\n\r\n").unwrap_or((&text, ""));
    let status = head.split_whitespace().nth(1).and_then(|code| code.parse().ok()).unwrap_or(0);
    Ok((status, body.to_string()))
}

#[cfg(not(unix))]
async fn unix_request(socket: &str, _path: &str) -> Result<(u16, String), String> {
    Err(format!("The Docker socket {socket} only works when the backend runs on Linux. Use a Docker host over HTTP instead."))
}
