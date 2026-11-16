use std::net::IpAddr;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::Serialize;

use crate::auth::CurrentUser;
use crate::backups;
use crate::error::ApiError;
use crate::login_guard;
use crate::mailer;
use crate::site_settings;
use crate::state::AppState;
use crate::two_factor;

/// What the Help page shows about this install, for people who can view System.
#[derive(Serialize)]
pub struct InstallStatus {
    email: bool,
    authenticator_app: bool,
    public_url: Option<String>,
    backup_tool: Option<String>,
    /// The address AeroStat sees for the person looking at the page.
    client_ip: String,
    /// True when that address is a private one, which usually means the proxy
    /// in front doesn't pass the visitor's address on.
    client_ip_private: bool,
}

fn is_private(ip: &str) -> bool {
    match ip.parse::<IpAddr>() {
        Ok(IpAddr::V4(v4)) => v4.is_private() || v4.is_loopback() || v4.is_link_local(),
        Ok(IpAddr::V6(v6)) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return v4.is_private() || v4.is_loopback() || v4.is_link_local();
            }
            let first = v6.segments()[0];
            v6.is_loopback() || (first & 0xfe00) == 0xfc00 || (first & 0xffc0) == 0xfe80
        }
        Err(_) => true,
    }
}

pub async fn status(State(state): State<AppState>, user: CurrentUser, headers: HeaderMap) -> Result<Json<InstallStatus>, ApiError> {
    user.require("system.view")?;
    let client_ip = login_guard::client_ip(&headers);
    Ok(Json(InstallStatus {
        email: mailer::config().is_some(),
        authenticator_app: two_factor::app_available(),
        public_url: site_settings::public_url(&state.db).await,
        backup_tool: backups::tool_version().await,
        client_ip_private: is_private(&client_ip),
        client_ip,
    }))
}
