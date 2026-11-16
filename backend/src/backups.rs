//! Database backups made with pg_dump. Each backup is two files in BACKUP_DIR:
//! the dump itself and a small JSON file about it. The list lives next to the
//! files and not in the database, so it stays right after a restore.

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::OnceLock;

use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::sync::Mutex;

static CONFIG: OnceLock<BackupConfig> = OnceLock::new();
/// One backup or restore at a time.
static RUNNING: Mutex<()> = Mutex::const_new(());

#[derive(Debug, Clone)]
pub struct BackupConfig {
    pub dir: PathBuf,
    pub pg_dump: String,
    pub pg_restore: String,
    pub psql: String,
    pub database_url: String,
}

impl BackupConfig {
    /// BACKUP_DIR, PG_DUMP_PATH, PG_RESTORE_PATH and PSQL_PATH, with defaults that fit the Docker image.
    pub fn from_env(database_url: &str) -> Self {
        let read = |name: &str| std::env::var(name).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
        Self {
            dir: PathBuf::from(read("BACKUP_DIR").unwrap_or_else(|| "/data/backups".into())),
            pg_dump: read("PG_DUMP_PATH").unwrap_or_else(|| "pg_dump".into()),
            pg_restore: read("PG_RESTORE_PATH").unwrap_or_else(|| "pg_restore".into()),
            psql: read("PSQL_PATH").unwrap_or_else(|| "psql".into()),
            database_url: database_url.to_string(),
        }
    }
}

pub fn init(config: BackupConfig) {
    let _ = CONFIG.set(config);
}

fn config() -> anyhow::Result<&'static BackupConfig> {
    CONFIG.get().ok_or_else(|| anyhow::anyhow!("Backups are not set up"))
}

pub fn dir() -> Option<String> {
    CONFIG.get().map(|config| config.dir.display().to_string())
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// Made with the button in the panel.
    Manual,
    /// Made by the schedule.
    Scheduled,
    /// Made on start, before a new version changed the database.
    Update,
    /// Made by the CLI right before a restore.
    Restore,
    /// Uploaded in the panel, for example from another server.
    Upload,
}

impl Kind {
    fn slug(self) -> &'static str {
        match self {
            Kind::Manual => "manual",
            Kind::Scheduled => "scheduled",
            Kind::Update => "update",
            Kind::Restore => "restore",
            Kind::Upload => "upload",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub id: String,
    pub created_at: DateTime<Utc>,
    /// The AeroStat version whose database this is.
    pub version: String,
    pub kind: Kind,
    pub created_by: Option<String>,
    pub size_bytes: u64,
    pub note: Option<String>,
}

/// Ids are made here and only ever hold these characters, so they are safe in paths.
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn dump_path(config: &BackupConfig, id: &str) -> PathBuf {
    config.dir.join(format!("{id}.dump"))
}

fn meta_path(config: &BackupConfig, id: &str) -> PathBuf {
    config.dir.join(format!("{id}.json"))
}

/// The pg_dump version line, or None when it can't run.
pub async fn tool_version() -> Option<String> {
    let config = CONFIG.get()?;
    let output = Command::new(&config.pg_dump).arg("--version").output().await.ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Runs pg_dump and stores the result. The dump goes to a temporary file first,
/// so a failed run never leaves half a backup in the list.
pub async fn create(kind: Kind, created_by: Option<String>, version: &str, note: Option<String>) -> anyhow::Result<Backup> {
    let config = config()?;
    let _guard = RUNNING.try_lock().map_err(|_| anyhow::anyhow!("A backup or restore is already running. Try again in a moment."))?;

    tokio::fs::create_dir_all(&config.dir)
        .await
        .map_err(|e| anyhow::anyhow!("Could not create the backup folder {}: {e}", config.dir.display()))?;

    let now = Utc::now();
    let suffix: u16 = rand::thread_rng().gen_range(0x1000..=0xffff);
    let id = format!("aerostat-{}-{}-{:x}", now.format("%Y%m%d-%H%M%S"), kind.slug(), suffix);
    let final_path = dump_path(config, &id);
    let partial_path = config.dir.join(format!("{id}.partial"));

    let result = run_dump(config, &partial_path).await;
    if let Err(e) = result {
        let _ = tokio::fs::remove_file(&partial_path).await;
        return Err(e);
    }
    tokio::fs::rename(&partial_path, &final_path).await?;
    let size_bytes = tokio::fs::metadata(&final_path).await?.len();

    let backup = Backup {
        id: id.clone(),
        created_at: now,
        version: version.to_string(),
        kind,
        created_by,
        size_bytes,
        note,
    };
    tokio::fs::write(meta_path(config, &id), serde_json::to_vec_pretty(&backup)?).await?;
    Ok(backup)
}

/// pg_dump writes to stdout and we write the file, so a pg_dump in another
/// container or behind a wrapper script works too.
async fn run_dump(config: &BackupConfig, path: &PathBuf) -> anyhow::Result<()> {
    let mut child = Command::new(&config.pg_dump)
        .args(["--format=custom", "--no-owner", "--no-privileges", "--dbname"])
        .arg(&config.database_url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| anyhow::anyhow!("Could not start pg_dump ({}): {e}", config.pg_dump))?;

    let mut stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("pg_dump gave no output"))?;
    let mut file = tokio::fs::File::create(path).await?;
    tokio::io::copy(&mut stdout, &mut file).await?;
    file.flush().await?;
    file.sync_all().await?;

    let output = child.wait_with_output().await?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        anyhow::bail!("pg_dump failed: {}", if message.is_empty() { "no error message".to_string() } else { message });
    }
    Ok(())
}

/// Largest allowed upload.
pub const MAX_UPLOAD_BYTES: u64 = 2 * 1024 * 1024 * 1024;

/// Stores an uploaded dump. It must be a pg_dump file in custom format that
/// pg_restore can read; the AeroStat version is read from inside it.
pub async fn import<S, E>(mut chunks: S, created_by: String, file_name: Option<String>) -> anyhow::Result<Backup>
where
    S: futures_util::Stream<Item = Result<bytes::Bytes, E>> + Unpin,
    E: std::fmt::Display,
{
    use futures_util::StreamExt;

    let config = config()?;
    let _guard = RUNNING.try_lock().map_err(|_| anyhow::anyhow!("A backup or restore is running. Try again in a moment."))?;
    tokio::fs::create_dir_all(&config.dir).await?;

    let now = Utc::now();
    let suffix: u16 = rand::thread_rng().gen_range(0x1000..=0xffff);
    let id = format!("aerostat-{}-{}-{:x}", now.format("%Y%m%d-%H%M%S"), Kind::Upload.slug(), suffix);
    let partial_path = config.dir.join(format!("{id}.partial"));

    let written: anyhow::Result<u64> = async {
        let mut file = tokio::fs::File::create(&partial_path).await?;
        let mut size: u64 = 0;
        while let Some(chunk) = chunks.next().await {
            let chunk = chunk.map_err(|e| anyhow::anyhow!("The upload broke off: {e}"))?;
            if size == 0 && !chunk.is_empty() && !chunk.starts_with(b"PGDMP") {
                anyhow::bail!("This is not an AeroStat backup. Upload a .dump file made by AeroStat or pg_dump --format=custom");
            }
            size += chunk.len() as u64;
            if size > MAX_UPLOAD_BYTES {
                anyhow::bail!("The file is larger than 2 GB");
            }
            file.write_all(&chunk).await?;
        }
        file.flush().await?;
        file.sync_all().await?;
        if size == 0 {
            anyhow::bail!("The file is empty");
        }
        Ok(size)
    }
    .await;
    let size_bytes = match written {
        Ok(size) => size,
        Err(e) => {
            let _ = tokio::fs::remove_file(&partial_path).await;
            return Err(e);
        }
    };

    let version = match dump_version(config, &partial_path).await {
        Ok(version) => version,
        Err(e) => {
            let _ = tokio::fs::remove_file(&partial_path).await;
            return Err(e);
        }
    };

    let final_path = dump_path(config, &id);
    tokio::fs::rename(&partial_path, &final_path).await?;
    let note = file_name
        .map(|name| name.chars().filter(|c| !c.is_control()).take(120).collect::<String>())
        .filter(|name| !name.is_empty())
        .map(|name| format!("Uploaded as {name}"));
    let backup = Backup {
        id: id.clone(),
        created_at: now,
        version,
        kind: Kind::Upload,
        created_by: Some(created_by),
        size_bytes,
        note,
    };
    tokio::fs::write(meta_path(config, &id), serde_json::to_vec_pretty(&backup)?).await?;
    Ok(backup)
}

/// Reads the newest version from the version_history table inside a dump.
/// This also checks that pg_restore can read the file at all.
async fn dump_version(config: &BackupConfig, path: &PathBuf) -> anyhow::Result<String> {
    let file = std::fs::File::open(path)?;
    let output = Command::new(&config.pg_restore)
        .args(["--data-only", "--table=version_history", "--file=-"])
        .stdin(Stdio::from(file))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|e| anyhow::anyhow!("Could not start pg_restore ({}): {e}", config.pg_restore))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        anyhow::bail!("pg_restore can't read this file: {message}");
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut in_copy = false;
    let mut newest: Option<(Vec<u64>, String)> = None;
    for line in text.lines() {
        if line.starts_with("COPY ") && line.contains("version_history") {
            in_copy = true;
            continue;
        }
        if !in_copy {
            continue;
        }
        if line == "\\." {
            break;
        }
        let Some(version) = line.split('\t').next() else { continue };
        let parts: Vec<u64> = version.split('.').map(|part| part.parse().unwrap_or(0)).collect();
        if newest.as_ref().is_none_or(|(best, _)| parts > *best) {
            newest = Some((parts, version.to_string()));
        }
    }
    match newest {
        Some((_, version)) => Ok(version),
        None => anyhow::bail!("This dump has no AeroStat data in it"),
    }
}

/// Every backup, newest first. Files without a readable JSON are skipped.
pub async fn list() -> anyhow::Result<Vec<Backup>> {
    let config = config()?;
    let mut backups = Vec::new();
    let mut entries = match tokio::fs::read_dir(&config.dir).await {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(backups),
        Err(e) => return Err(anyhow::anyhow!("Could not read the backup folder {}: {e}", config.dir.display())),
    };
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let Ok(bytes) = tokio::fs::read(&path).await else { continue };
        let Ok(backup) = serde_json::from_slice::<Backup>(&bytes) else { continue };
        if valid_id(&backup.id) && tokio::fs::metadata(dump_path(config, &backup.id)).await.is_ok() {
            backups.push(backup);
        }
    }
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

pub async fn find(id: &str) -> anyhow::Result<Option<Backup>> {
    if !valid_id(id) {
        return Ok(None);
    }
    Ok(list().await?.into_iter().find(|backup| backup.id == id))
}

/// Where the dump of a backup is, for downloads.
pub fn file_path(id: &str) -> anyhow::Result<PathBuf> {
    let config = config()?;
    if !valid_id(id) {
        anyhow::bail!("Unknown backup");
    }
    Ok(dump_path(config, id))
}

pub async fn delete(id: &str) -> anyhow::Result<()> {
    let config = config()?;
    if !valid_id(id) {
        anyhow::bail!("Unknown backup");
    }
    let _ = tokio::fs::remove_file(dump_path(config, id)).await;
    let _ = tokio::fs::remove_file(meta_path(config, id)).await;
    Ok(())
}

/// Keeps the newest `keep` backups of one kind and deletes the rest.
pub async fn prune(kind: Kind, keep: usize) -> anyhow::Result<usize> {
    let old: Vec<Backup> = list().await?.into_iter().filter(|backup| backup.kind == kind).skip(keep).collect();
    for backup in &old {
        delete(&backup.id).await?;
    }
    Ok(old.len())
}

/// Puts a backup back. The whole schema is dropped and made again from the
/// backup in one transaction, so tables from newer versions don't stay behind
/// and a failed restore changes nothing.
pub async fn restore(id: &str) -> anyhow::Result<()> {
    let config = config()?;
    if !valid_id(id) {
        anyhow::bail!("Unknown backup");
    }
    let _guard = RUNNING.try_lock().map_err(|_| anyhow::anyhow!("A backup or restore is already running"))?;
    let path = dump_path(config, id);
    let mut file = tokio::fs::File::open(&path)
        .await
        .map_err(|e| anyhow::anyhow!("Could not open {}: {e}", path.display()))?;

    // pg_restore turns the dump into SQL, psql runs it.
    let mut to_sql = Command::new(&config.pg_restore)
        .args(["--no-owner", "--no-privileges", "--file=-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| anyhow::anyhow!("Could not start pg_restore ({}): {e}", config.pg_restore))?;
    let mut psql = Command::new(&config.psql)
        .args(["--quiet", "--no-psqlrc", "--single-transaction", "--set=ON_ERROR_STOP=1", "--dbname"])
        .arg(&config.database_url)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| anyhow::anyhow!("Could not start psql ({}): {e}", config.psql))?;

    let mut dump_in = to_sql.stdin.take().ok_or_else(|| anyhow::anyhow!("pg_restore takes no input"))?;
    let mut sql_out = to_sql.stdout.take().ok_or_else(|| anyhow::anyhow!("pg_restore gave no output"))?;
    let mut psql_in = psql.stdin.take().ok_or_else(|| anyhow::anyhow!("psql takes no input"))?;

    let feed = async move {
        tokio::io::copy(&mut file, &mut dump_in).await?;
        drop(dump_in);
        anyhow::Ok(())
    };
    let pipe = async move {
        psql_in.write_all(b"DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\n").await?;
        tokio::io::copy(&mut sql_out, &mut psql_in).await?;
        psql_in.shutdown().await?;
        drop(psql_in);
        anyhow::Ok(())
    };
    let (fed, piped) = tokio::join!(feed, pipe);

    let converted = to_sql.wait_with_output().await?;
    let applied = psql.wait_with_output().await?;
    if !converted.status.success() {
        let message = String::from_utf8_lossy(&converted.stderr).trim().to_string();
        anyhow::bail!("pg_restore could not read the backup, nothing was changed: {message}");
    }
    if !applied.status.success() {
        let message = String::from_utf8_lossy(&applied.stderr).trim().to_string();
        anyhow::bail!("The restore failed, nothing was changed: {message}");
    }
    fed?;
    piped?;
    Ok(())
}

/// Kept "before update" backups.
const KEEP_UPDATE_BACKUPS: usize = 3;

/// On start, before migrations: when this version runs for the first time on
/// a database an older version made, back it up first. A failure is logged and
/// the start goes on, so a missing pg_dump never keeps AeroStat down.
pub async fn before_update(db: &sqlx::PgPool, current: &str) {
    let previous: Option<String> = match sqlx::query_scalar::<_, Option<String>>(
        "SELECT CASE WHEN to_regclass('public.version_history') IS NULL THEN NULL ELSE '' END",
    )
    .fetch_one(db)
    .await
    {
        Ok(Some(_)) => {
            let seen: Option<(bool, Option<String>)> = sqlx::query_as(
                "SELECT EXISTS (SELECT 1 FROM version_history WHERE version = $1), \
                 (SELECT version FROM version_history ORDER BY first_seen_at DESC LIMIT 1)",
            )
            .bind(current)
            .fetch_optional(db)
            .await
            .ok()
            .flatten();
            match seen {
                Some((false, Some(previous))) => Some(previous),
                _ => None,
            }
        }
        _ => None,
    };
    let Some(previous) = previous else { return };
    if !crate::site_settings::backup_before_update(db).await {
        tracing::info!("Updating from v{previous} to v{current}, backup before update is off");
        return;
    }

    tracing::info!("Updating from v{previous} to v{current}, making a backup first");
    match create(Kind::Update, None, &previous, Some(format!("Before updating to v{current}"))).await {
        Ok(backup) => {
            tracing::info!("Backup {} made ({} bytes)", backup.id, backup.size_bytes);
            if let Err(e) = prune(Kind::Update, KEEP_UPDATE_BACKUPS).await {
                tracing::warn!("Could not remove old update backups: {e:#}");
            }
        }
        Err(e) => tracing::warn!("Could not make a backup before the update, going on without one: {e:#}"),
    }
}

/// Makes scheduled backups. Checks every ten minutes; a backup is due after
/// 03:00 in the site's timezone when the last one is from an earlier day
/// (daily) or at least a week old (weekly). After a failure it waits an hour.
pub fn spawn_schedule(db: sqlx::PgPool, version: &'static str) {
    tokio::spawn(async move {
        let mut wait_until: Option<DateTime<Utc>> = None;
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(600)).await;
            if wait_until.is_some_and(|until| Utc::now() < until) {
                continue;
            }
            let schedule = crate::site_settings::backup_schedule(&db).await;
            let days = match schedule.as_str() {
                "daily" => 1,
                "weekly" => 7,
                _ => continue,
            };
            let tz = crate::site_settings::timezone(&db).await;
            let local = Utc::now().with_timezone(&tz);
            if chrono::Timelike::hour(&local) < 3 {
                continue;
            }
            let last = match list().await {
                Ok(backups) => backups.into_iter().find(|backup| backup.kind == Kind::Scheduled),
                Err(e) => {
                    tracing::warn!("Could not read the backups: {e:#}");
                    wait_until = Some(Utc::now() + chrono::Duration::hours(1));
                    continue;
                }
            };
            let due = match last {
                None => true,
                Some(backup) => (local.date_naive() - backup.created_at.with_timezone(&tz).date_naive()).num_days() >= days,
            };
            if !due {
                continue;
            }
            match create(Kind::Scheduled, None, version, None).await {
                Ok(backup) => {
                    tracing::info!("Scheduled backup {} made ({} bytes)", backup.id, backup.size_bytes);
                    let keep = crate::site_settings::backup_keep(&db).await.max(1) as usize;
                    if let Err(e) = prune(Kind::Scheduled, keep).await {
                        tracing::warn!("Could not remove old scheduled backups: {e:#}");
                    }
                    wait_until = None;
                }
                Err(e) => {
                    tracing::warn!("Scheduled backup failed, trying again in an hour: {e:#}");
                    wait_until = Some(Utc::now() + chrono::Duration::hours(1));
                }
            }
        }
    });
}
