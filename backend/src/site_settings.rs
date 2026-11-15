use std::collections::HashMap;

use chrono::{DateTime, Duration, LocalResult, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use sqlx::PgPool;

pub const SITE_NAME: &str = "site_name";
pub const SITE_DESCRIPTION: &str = "site_description";
pub const CONTACT_URL: &str = "contact_url";
pub const PRIMARY_COLOR: &str = "primary_color";
pub const TIMEZONE: &str = "timezone";
pub const METRICS_RETENTION_DAYS: &str = "metrics_retention_days";

pub const KEYS: [&str; 6] = [SITE_NAME, SITE_DESCRIPTION, CONTACT_URL, PRIMARY_COLOR, TIMEZONE, METRICS_RETENTION_DAYS];

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
