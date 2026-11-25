use std::collections::HashMap;

use chrono::{DateTime, Duration, LocalResult, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use sqlx::PgPool;

pub const SITE_NAME: &str = "site_name";
pub const SITE_DESCRIPTION: &str = "site_description";
pub const CONTACT_URL: &str = "contact_url";
/// Who the site belongs to and their website, for the copyright line.
pub const COMPANY_NAME: &str = "company_name";
pub const COMPANY_URL: &str = "company_url";
pub const PRIMARY_COLOR: &str = "primary_color";
pub const TIMEZONE: &str = "timezone";
pub const METRICS_RETENTION_DAYS: &str = "metrics_retention_days";
/// The address visitors use, for links in notifications and for passkeys.
pub const PUBLIC_URL: &str = "public_url";
/// Failed checks in a row before a service counts as down and people get a message.
pub const DOWN_AFTER_CHECKS: &str = "down_after_checks";
pub const DEFAULT_DOWN_AFTER_CHECKS: i64 = 2;
/// How much slower than usual a service must answer before people are warned,
/// in percent, or "off".
pub const SLOW_ALERT_PERCENT: &str = "slow_alert_percent";
pub const DEFAULT_SLOW_ALERT_PERCENT: i64 = 100;
/// A service counts as slow when this many of the last SLOW_WINDOW checks
/// were slow. The default of 3 of 5 keeps one hiccup quiet.
pub const SLOW_CHECKS: &str = "slow_checks";
pub const DEFAULT_SLOW_CHECKS: i64 = 3;
pub const SLOW_WINDOW: &str = "slow_window";
pub const DEFAULT_SLOW_WINDOW: i64 = 5;
/// "off", "daily" or "weekly". Scheduled backups run after 03:00 in the site's timezone.
pub const BACKUP_SCHEDULE: &str = "backup_schedule";
pub const DEFAULT_BACKUP_SCHEDULE: &str = "daily";
/// How many scheduled backups to keep.
pub const BACKUP_KEEP: &str = "backup_keep";
pub const DEFAULT_BACKUP_KEEP: i64 = 7;
/// "true" or "false": make a backup on start when a new version is about to change the database.
pub const BACKUP_BEFORE_UPDATE: &str = "backup_before_update";

pub const KEYS: [&str; 16] = [
    SITE_NAME,
    SITE_DESCRIPTION,
    CONTACT_URL,
    COMPANY_NAME,
    COMPANY_URL,
    PUBLIC_URL,
    PRIMARY_COLOR,
    TIMEZONE,
    METRICS_RETENTION_DAYS,
    DOWN_AFTER_CHECKS,
    SLOW_ALERT_PERCENT,
    SLOW_CHECKS,
    SLOW_WINDOW,
    BACKUP_SCHEDULE,
    BACKUP_KEEP,
    BACKUP_BEFORE_UPDATE,
];

/// The settings permission needed to change a key, one per tab in the panel.
pub fn permission_for(key: &str) -> &'static str {
    match key {
        PRIMARY_COLOR => "settings.appearance",
        TIMEZONE => "settings.time",
        METRICS_RETENTION_DAYS | DOWN_AFTER_CHECKS | SLOW_ALERT_PERCENT | SLOW_CHECKS | SLOW_WINDOW => "settings.monitoring",
        BACKUP_SCHEDULE | BACKUP_KEEP | BACKUP_BEFORE_UPDATE => "system.backups",
        _ => "settings.general",
    }
}

/// Every permission that opens a part of the settings page except notifications.
pub const PAGE_PERMISSIONS: [&str; 5] = ["settings.general", "settings.appearance", "settings.monitoring", "settings.docker", "settings.time"];

pub async fn all(db: &PgPool) -> anyhow::Result<HashMap<String, String>> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(db)
        .await?;
    Ok(rows.into_iter().collect())
}

async fn get(db: &PgPool, key: &str) -> anyhow::Result<Option<String>> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = $1")
        .bind(key)
        .fetch_optional(db)
        .await?;
    Ok(row.map(|(value,)| value))
}

/// The status page address without a trailing slash, when it is set.
pub async fn public_url(db: &PgPool) -> Option<String> {
    get(db, PUBLIC_URL).await.ok().flatten()
}

/// The site's timezone; UTC when unset or unreadable.
pub async fn timezone(db: &PgPool) -> Tz {
    match get(db, TIMEZONE).await {
        Ok(Some(name)) => name.parse().unwrap_or(Tz::UTC),
        _ => Tz::UTC,
    }
}

/// Retention from the panel, otherwise the METRICS_RETENTION_DAYS env value.
pub async fn retention_days(db: &PgPool, fallback: i32) -> i32 {
    match get(db, METRICS_RETENTION_DAYS).await {
        Ok(Some(value)) => value.parse().unwrap_or(fallback),
        _ => fallback,
    }
}

pub async fn down_after_checks(db: &PgPool) -> i64 {
    match get(db, DOWN_AFTER_CHECKS).await {
        Ok(Some(value)) => value.parse().unwrap_or(DEFAULT_DOWN_AFTER_CHECKS),
        _ => DEFAULT_DOWN_AFTER_CHECKS,
    }
}

/// The slow-response threshold in percent, or None when the warning is off.
pub async fn slow_alert_percent(db: &PgPool) -> Option<i64> {
    match get(db, SLOW_ALERT_PERCENT).await {
        Ok(Some(value)) if value == "off" => None,
        Ok(Some(value)) => Some(value.parse().unwrap_or(DEFAULT_SLOW_ALERT_PERCENT)),
        _ => Some(DEFAULT_SLOW_ALERT_PERCENT),
    }
}

/// (slow checks, out of the last checks), with the slow count never above the window.
pub async fn slow_rule(db: &PgPool) -> (i64, i64) {
    let window = match get(db, SLOW_WINDOW).await {
        Ok(Some(value)) => value.parse().unwrap_or(DEFAULT_SLOW_WINDOW),
        _ => DEFAULT_SLOW_WINDOW,
    };
    let checks = match get(db, SLOW_CHECKS).await {
        Ok(Some(value)) => value.parse().unwrap_or(DEFAULT_SLOW_CHECKS),
        _ => DEFAULT_SLOW_CHECKS,
    };
    let window = window.max(1);
    (checks.clamp(1, window), window)
}

pub async fn backup_schedule(db: &PgPool) -> String {
    match get(db, BACKUP_SCHEDULE).await {
        Ok(Some(value)) => value,
        _ => DEFAULT_BACKUP_SCHEDULE.to_string(),
    }
}

pub async fn backup_keep(db: &PgPool) -> i64 {
    match get(db, BACKUP_KEEP).await {
        Ok(Some(value)) => value.parse().unwrap_or(DEFAULT_BACKUP_KEEP),
        _ => DEFAULT_BACKUP_KEEP,
    }
}

pub async fn backup_before_update(db: &PgPool) -> bool {
    !matches!(get(db, BACKUP_BEFORE_UPDATE).await, Ok(Some(value)) if value == "false")
}

pub fn today(tz: Tz) -> NaiveDate {
    Utc::now().with_timezone(&tz).date_naive()
}

/// Start of a local calendar day as a UTC instant. On a DST gap at midnight
/// the first valid moment after it is used.
pub fn start_of_day(date: NaiveDate, tz: Tz) -> DateTime<Utc> {
    let mut naive = date.and_hms_opt(0, 0, 0).unwrap();
    loop {
        match tz.from_local_datetime(&naive) {
            LocalResult::Single(moment) => return moment.with_timezone(&Utc),
            LocalResult::Ambiguous(first, _) => return first.with_timezone(&Utc),
            LocalResult::None => naive += Duration::minutes(15),
        }
    }
}

/// [start, end) of a local calendar day in UTC.
pub fn day_bounds(date: NaiveDate, tz: Tz) -> (DateTime<Utc>, DateTime<Utc>) {
    (start_of_day(date, tz), start_of_day(date + Duration::days(1), tz))
}
