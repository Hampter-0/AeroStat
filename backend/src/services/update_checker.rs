use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Deserialize;
use tokio::sync::RwLock;

const REPOSITORY: &str = "Hampter-0/AeroStat";
const INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);
/// A manual check within this many seconds of the last one reuses its result,
/// so clicking the button can't run into GitHub's rate limit.
const MIN_SECONDS_BETWEEN_CHECKS: i64 = 30;
const USER_AGENT: &str = concat!("AeroStat/", env!("CARGO_PKG_VERSION"), " (+https://github.com/Hampter-0/AeroStat)");

pub const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone, Debug)]
pub struct LatestRelease {
    pub version: String,
    pub url: String,
}

#[derive(Clone, Debug)]
pub struct ReleaseInfo {
    pub version: String,
    pub url: String,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Default)]
pub struct UpdateState {
    pub latest: Option<LatestRelease>,
    /// Newest first, drafts and prereleases left out.
    pub releases: Vec<ReleaseInfo>,
    pub checked_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

pub type UpdateCache = Arc<RwLock<UpdateState>>;

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    draft: bool,
    prerelease: bool,
    published_at: Option<DateTime<Utc>>,
}

/// Asks GitHub for the latest release every few hours. Only the release
/// version is read; nothing about this installation is sent.
pub fn spawn(cache: UpdateCache) {
    tokio::spawn(async move {
        loop {
            check(&cache).await;
            tokio::time::sleep(INTERVAL).await;
        }
    });
}

/// Checks now, unless the last check was less than half a minute ago.
pub async fn check_now(cache: &UpdateCache) {
    let recent = cache
        .read()
        .await
        .checked_at
        .map(|at| (Utc::now() - at).num_seconds() < MIN_SECONDS_BETWEEN_CHECKS)
        .unwrap_or(false);
    if !recent {
        check(cache).await;
    }
}

async fn check(cache: &UpdateCache) {
    let result = fetch_releases().await;
    let mut state = cache.write().await;
    state.checked_at = Some(Utc::now());
    match result {
        Ok(releases) => {
            state.error = None;
            // The highest version, not the most recently published one, in
            // case an older line gets a patch release later.
            let newest = releases.iter().fold(None::<&ReleaseInfo>, |best, release| match best {
                Some(best) if !is_newer(&release.version, &best.version) => Some(best),
                _ => Some(release),
            });
            if let Some(newest) = newest {
                state.latest = Some(LatestRelease {
                    version: newest.version.clone(),
                    url: newest.url.clone(),
                });
            }
            state.releases = releases;
        }
        Err(e) => {
            tracing::warn!("Update check failed: {e}");
            state.error = Some("Could not reach GitHub".to_string());
        }
    }
}

async fn fetch_releases() -> anyhow::Result<Vec<ReleaseInfo>> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(15))
        .build()?;
    let response = client
        .get(format!("https://api.github.com/repos/{REPOSITORY}/releases?per_page=15"))
        .header("accept", "application/vnd.github+json")
        .send()
        .await?;
    let releases: Vec<GithubRelease> = response.error_for_status()?.json().await?;
    Ok(releases
        .into_iter()
        .filter(|release| !release.draft && !release.prerelease)
        .map(|release| ReleaseInfo {
            version: release.tag_name.trim_start_matches('v').to_string(),
            url: release.html_url,
            published_at: release.published_at,
        })
        .collect())
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
