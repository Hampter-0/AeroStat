use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use tokio::sync::RwLock;

const REPOSITORY: &str = "Hampter-0/AeroStat";
const INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);
const USER_AGENT: &str = concat!("AeroStat/", env!("CARGO_PKG_VERSION"), " (+https://github.com/Hampter-0/AeroStat)");

pub const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone, Debug)]
pub struct LatestRelease {
    pub version: String,
    pub url: String,
}

/// The newest release found on GitHub, or None until a check succeeds.
pub type LatestReleaseCache = Arc<RwLock<Option<LatestRelease>>>;

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    draft: bool,
    prerelease: bool,
}

/// Asks GitHub for the latest release every few hours. Only the release
/// version is read; nothing about this installation is sent.
pub fn spawn(cache: LatestReleaseCache) {
    tokio::spawn(async move {
        let client = match reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(15))
            .build()
        {
            Ok(client) => client,
            Err(e) => {
                tracing::warn!("Update check disabled, could not set up the HTTP client: {e}");
                return;
            }
        };

        loop {
            match fetch_latest(&client).await {
                Ok(Some(release)) => *cache.write().await = Some(release),
                Ok(None) => {}
                Err(e) => tracing::warn!("Update check failed: {e}"),
            }
            tokio::time::sleep(INTERVAL).await;
        }
    });
}

async fn fetch_latest(client: &reqwest::Client) -> anyhow::Result<Option<LatestRelease>> {
    let response = client
        .get(format!("https://api.github.com/repos/{REPOSITORY}/releases/latest"))
        .header("accept", "application/vnd.github+json")
        .send()
        .await?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    let release: GithubRelease = response.error_for_status()?.json().await?;
    if release.draft || release.prerelease {
        return Ok(None);
    }
    Ok(Some(LatestRelease {
        version: release.tag_name.trim_start_matches('v').to_string(),
        url: release.html_url,
    }))
}

fn parse_version(text: &str) -> Option<(u64, u64, u64)> {
    let mut parts = text.trim().trim_start_matches('v').split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.split('-').next()?.parse().ok()?;
    Some((major, minor, patch))
}

pub fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::is_newer;

    #[test]
    fn compares_versions() {
        assert!(is_newer("0.4.0", "0.3.0"));
        assert!(is_newer("v0.10.0", "0.9.9"));
        assert!(is_newer("1.0.0", "0.99.0"));
        assert!(!is_newer("0.3.0", "0.3.0"));
        assert!(!is_newer("0.2.9", "0.3.0"));
        assert!(!is_newer("nonsense", "0.3.0"));
    }
}
