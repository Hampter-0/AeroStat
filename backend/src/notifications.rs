//! Notifications about services, incidents and maintenance. Each event is
//! sent to every configured channel; for now that is a Discord webhook.

use std::time::Duration;

use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::site_settings;

const USER_AGENT: &str = concat!("AeroStat/", env!("CARGO_PKG_VERSION"), " (+https://github.com/Hampter-0/AeroStat)");

pub const EVENT_KINDS: [&str; 9] = [
    "service_down",
    "service_up",
    "incident_created",
    "incident_updated",
    "incident_resolved",
    "maintenance_scheduled",
    "maintenance_started",
    "maintenance_completed",
    "maintenance_cancelled",
];

const RED: u32 = 0xE5484D;
const GREEN: u32 = 0x2EA043;
const YELLOW: u32 = 0xD29922;
const BLUE: u32 = 0x1678C2;
const GREY: u32 = 0x8B949E;

pub enum Event {
    ServiceDown {
        service_id: String,
        status_code: Option<i32>,
        since: DateTime<Utc>,
    },
    ServiceUp {
        service_id: String,
        down_since: DateTime<Utc>,
    },
    IncidentCreated {
        id: i64,
        title: String,
        status: String,
        severity: String,
        message: String,
        services: Vec<String>,
    },
    IncidentUpdated {
        id: i64,
        title: String,
        status: String,
        message: String,
        services: Vec<String>,
    },
    MaintenanceScheduled {
        id: i64,
        title: String,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        services: Vec<String>,
    },
    MaintenanceStarted {
        id: i64,
        title: String,
        end: DateTime<Utc>,
        services: Vec<String>,
    },
    MaintenanceCompleted {
        id: i64,
        title: String,
        services: Vec<String>,
    },
    MaintenanceCancelled {
        id: i64,
        title: String,
        message: String,
        services: Vec<String>,
    },
}

impl Event {
    pub fn kind(&self) -> &'static str {
        match self {
            Event::ServiceDown { .. } => "service_down",
            Event::ServiceUp { .. } => "service_up",
            Event::IncidentCreated { .. } => "incident_created",
            Event::IncidentUpdated { status, .. } if status == "resolved" => "incident_resolved",
            Event::IncidentUpdated { .. } => "incident_updated",
            Event::MaintenanceScheduled { .. } => "maintenance_scheduled",
            Event::MaintenanceStarted { .. } => "maintenance_started",
            Event::MaintenanceCompleted { .. } => "maintenance_completed",
            Event::MaintenanceCancelled { .. } => "maintenance_cancelled",
        }
    }
}

#[derive(sqlx::FromRow)]
pub struct NotificationSettings {
    pub discord_webhook_url: Option<String>,
    pub public_url: Option<String>,
    pub events: Vec<String>,
}

pub async fn load(db: &PgPool) -> anyhow::Result<NotificationSettings> {
    let settings = sqlx::query_as("SELECT discord_webhook_url, public_url, events FROM notification_settings")
        .fetch_one(db)
        .await?;
    Ok(settings)
}

/// Only real Discord webhooks are accepted, so this field can't be used to make
/// the server call arbitrary addresses.
pub fn is_discord_webhook(url: &str) -> bool {
    let Ok(parsed) = reqwest::Url::parse(url) else {
        return false;
    };
    let host_ok = matches!(
        parsed.host_str(),
        Some("discord.com" | "discordapp.com" | "canary.discord.com" | "ptb.discord.com")
    );
    parsed.scheme() == "https" && host_ok && parsed.path().starts_with("/api/webhooks/")
}

/// Sends the event in the background, so the action that caused it never waits
/// for Discord.
pub fn notify(db: &PgPool, event: Event) {
    let db = db.clone();
    tokio::spawn(async move {
        if let Err(e) = deliver(&db, event).await {
            tracing::warn!("Could not send a notification: {e}");
        }
    });
}

async fn deliver(db: &PgPool, event: Event) -> anyhow::Result<()> {
    let settings = load(db).await?;
    if !settings.events.iter().any(|kind| kind == event.kind()) {
        return Ok(());
    }
    let Some(webhook) = settings.discord_webhook_url.as_deref() else {
        return Ok(());
    };
    let payload = discord_payload(db, &settings, &event).await?;
    send_discord(webhook, &payload).await
}

/// Posts to the webhook and returns Discord's error text if it refuses.
pub async fn send_discord(webhook: &str, payload: &Value) -> anyhow::Result<()> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(10))
        .build()?;
    let response = client.post(webhook).json(payload).send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Discord answered {status}: {}", body.chars().take(200).collect::<String>());
    }
    Ok(())
}

async fn site_name(db: &PgPool) -> String {
    site_settings::all(db)
        .await
        .ok()
        .and_then(|mut values| values.remove(site_settings::SITE_NAME))
        .unwrap_or_else(|| "AeroStat".to_string())
}

async fn service_names(db: &PgPool, ids: &[String]) -> Vec<String> {
    if ids.is_empty() {
        return Vec::new();
    }
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT id, name FROM services WHERE id = ANY($1)")
        .bind(ids)
        .fetch_all(db)
        .await
        .unwrap_or_default();
    ids.iter()
        .map(|id| {
            rows.iter()
                .find(|(row_id, _)| row_id == id)
                .map(|(_, name)| name.clone())
                .unwrap_or_else(|| id.clone())
        })
        .collect()
}

fn link(settings: &NotificationSettings, path: &str) -> Option<String> {
    settings
        .public_url
        .as_deref()
        .map(|base| format!("{}{}", base.trim_end_matches('/'), path))
}

/// The share card for a page, with a version so Discord does not reuse an old image.
fn image(settings: &NotificationSettings, path: &str) -> Option<String> {
    link(settings, &format!("{path}?v={}", Utc::now().timestamp()))
}

fn image_path(event: &Event) -> String {
    match event {
        Event::ServiceDown { .. } | Event::ServiceUp { .. } => "/og/status".to_string(),
        Event::IncidentCreated { id, .. } | Event::IncidentUpdated { id, .. } => format!("/og/incidents/{id}"),
        Event::MaintenanceScheduled { id, .. }
        | Event::MaintenanceStarted { id, .. }
        | Event::MaintenanceCompleted { id, .. }
        | Event::MaintenanceCancelled { id, .. } => format!("/og/maintenance/{id}"),
    }
}

fn discord_time(at: DateTime<Utc>) -> String {
    format!("<t:{}:f>", at.timestamp())
}

fn duration_text(seconds: i64) -> String {
    let minutes = (seconds + 59) / 60;
    if minutes < 60 {
        return format!("{minutes} min");
    }
    let hours = minutes / 60;
    let rest = minutes % 60;
    if hours < 24 {
        return format!("{hours} h {rest} min");
    }
    format!("{} d {} h", hours / 24, hours % 24)
}

fn capitalize(text: &str) -> String {
    let mut chars = text.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// The Discord message for an event.
pub async fn discord_payload(db: &PgPool, settings: &NotificationSettings, event: &Event) -> anyhow::Result<Value> {
    let site = site_name(db).await;
    let mut fields: Vec<Value> = Vec::new();

    let (title, description, color, url, services) = match event {
        Event::ServiceDown { service_id, status_code, since } => {
            let name = service_names(db, std::slice::from_ref(service_id)).await.remove(0);
            let reason = match status_code {
                Some(code) => format!("It answered with status {code}."),
                None => "It did not answer.".to_string(),
            };
            (
                format!("{name} is down"),
                format!("{reason} Down since {}.", discord_time(*since)),
                RED,
                link(settings, "/"),
                Vec::new(),
            )
        }
        Event::ServiceUp { service_id, down_since } => {
            let name = service_names(db, std::slice::from_ref(service_id)).await.remove(0);
            let seconds = (Utc::now() - *down_since).num_seconds().max(0);
            (
                format!("{name} is back up"),
                format!("It was down for {}.", duration_text(seconds)),
                GREEN,
                link(settings, "/"),
                Vec::new(),
            )
        }
        Event::IncidentCreated { id, title, status, severity, message, services } => {
            fields.push(json!({ "name": "Status", "value": capitalize(status), "inline": true }));
            fields.push(json!({ "name": "Severity", "value": capitalize(severity), "inline": true }));
            (
                format!("New incident: {title}"),
                message.clone(),
                YELLOW,
                link(settings, &format!("/incidents/{id}")),
                services.clone(),
            )
        }
        Event::IncidentUpdated { id, title, status, message, services } => {
            if status == "resolved" {
                (
                    format!("Incident resolved: {title}"),
                    message.clone(),
                    GREEN,
                    link(settings, &format!("/incidents/{id}")),
                    services.clone(),
                )
            } else {
                fields.push(json!({ "name": "Status", "value": capitalize(status), "inline": true }));
                (
                    format!("Incident update: {title}"),
                    message.clone(),
                    YELLOW,
                    link(settings, &format!("/incidents/{id}")),
                    services.clone(),
                )
            }
        }
        Event::MaintenanceScheduled { id, title, start, end, services } => (
            format!("Maintenance planned: {title}"),
            format!("From {} to {}.", discord_time(*start), discord_time(*end)),
            BLUE,
            link(settings, &format!("/maintenance/{id}")),
            services.clone(),
        ),
        Event::MaintenanceStarted { id, title, end, services } => (
            format!("Maintenance started: {title}"),
            format!("Planned to end at {}.", discord_time(*end)),
            BLUE,
            link(settings, &format!("/maintenance/{id}")),
            services.clone(),
        ),
        Event::MaintenanceCompleted { id, title, services } => (
            format!("Maintenance completed: {title}"),
            "Everything should work normally again.".to_string(),
            GREEN,
            link(settings, &format!("/maintenance/{id}")),
            services.clone(),
        ),
        Event::MaintenanceCancelled { id, title, message, services } => (
            format!("Maintenance cancelled: {title}"),
            message.clone(),
            GREY,
            link(settings, &format!("/maintenance/{id}")),
            services.clone(),
        ),
    };

    let names = service_names(db, &services).await;
    if !names.is_empty() {
        fields.push(json!({ "name": "Affected services", "value": names.join(", "), "inline": false }));
    }

    let mut embed = json!({
        "title": title.chars().take(256).collect::<String>(),
        "description": description.chars().take(2000).collect::<String>(),
        "color": color,
        "fields": fields,
        "footer": { "text": site },
        "timestamp": Utc::now().to_rfc3339(),
    });
    if let Some(url) = url {
        embed["url"] = json!(url);
    }
    if let Some(image) = image(settings, &image_path(event)) {
        embed["image"] = json!({ "url": image });
    }

    Ok(json!({ "username": site, "embeds": [embed] }))
}

/// A sample message for the "Send test message" button.
pub async fn test_payload(db: &PgPool, settings: &NotificationSettings) -> Value {
    let site = site_name(db).await;
    let mut embed = json!({
        "title": "Notifications are working",
        "description": "This channel will get a message when a service goes down or comes back, and when an incident or maintenance is posted.",
        "color": GREEN,
        "footer": { "text": site },
        "timestamp": Utc::now().to_rfc3339(),
    });
    if let Some(url) = link(settings, "/") {
        embed["url"] = json!(url);
    }
    if let Some(image) = image(settings, "/og/status") {
        embed["image"] = json!({ "url": image });
    }
    json!({ "username": site, "embeds": [embed] })
}

/// Called after every check. Sends "down" on the second failed check in a row
/// and "up" on the first good check after such an outage, so a single hiccup
/// stays quiet.
pub async fn after_check(db: &PgPool, service_id: &str) {
    let rows: Vec<(String, DateTime<Utc>, Option<i32>)> = match sqlx::query_as(
        "SELECT status, checked_at, status_code FROM metrics WHERE service_id = $1 ORDER BY checked_at DESC LIMIT 3",
    )
    .bind(service_id)
    .fetch_all(db)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("Could not read recent checks for {service_id}: {e}");
            return;
        }
    };
    let offline = |index: usize| rows.get(index).map(|row| row.0 == "offline").unwrap_or(false);
    let online = |index: usize| rows.get(index).map(|row| row.0 == "online").unwrap_or(false);

    if offline(0) && offline(1) && (rows.len() < 3 || online(2)) {
        notify(
            db,
            Event::ServiceDown {
                service_id: service_id.to_string(),
                status_code: rows[0].2,
                since: rows[1].1,
            },
        );
    } else if online(0) && offline(1) && offline(2) {
        let since: Option<(Option<DateTime<Utc>>,)> = sqlx::query_as(
            r#"
            SELECT MIN(checked_at) FROM metrics
            WHERE service_id = $1 AND status = 'offline'
              AND checked_at > COALESCE(
                  (SELECT MAX(checked_at) FROM metrics WHERE service_id = $1 AND status = 'online' AND checked_at < $2),
                  '-infinity'::timestamptz)
            "#,
        )
        .bind(service_id)
        .bind(rows[0].1)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();
        let down_since = since.and_then(|(at,)| at).unwrap_or(rows[1].1);
        notify(
            db,
            Event::ServiceUp {
                service_id: service_id.to_string(),
                down_since,
            },
        );
    }
}

#[derive(sqlx::FromRow)]
struct MaintenanceRow {
    id: i64,
    title: String,
    scheduled_start: DateTime<Utc>,
    scheduled_end: DateTime<Utc>,
    affected_services: Option<Vec<String>>,
}

/// Sends "started" and "completed" when a maintenance window begins or ends.
/// Windows that passed more than ten minutes ago are marked without a message,
/// so a restart after downtime doesn't flood the channel.
pub fn spawn_maintenance_watcher(db: PgPool) {
    tokio::spawn(async move {
        loop {
            if let Err(e) = check_maintenance(&db).await {
                tracing::warn!("Maintenance notifications failed: {e}");
            }
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
}

async fn check_maintenance(db: &PgPool) -> anyhow::Result<()> {
    let started: Vec<MaintenanceRow> = sqlx::query_as(
        r#"
        UPDATE maintenance SET start_notified = true
        WHERE NOT start_notified AND status <> 'cancelled' AND scheduled_start <= now()
        RETURNING id, title, scheduled_start, scheduled_end, affected_services
        "#,
    )
    .fetch_all(db)
    .await?;
    for row in started {
        let fresh = Utc::now() - row.scheduled_start < chrono::Duration::minutes(10);
        if fresh && row.scheduled_end > Utc::now() {
            notify(
                db,
                Event::MaintenanceStarted {
                    id: row.id,
                    title: row.title,
                    end: row.scheduled_end,
                    services: row.affected_services.unwrap_or_default(),
                },
            );
        }
    }

    let ended: Vec<MaintenanceRow> = sqlx::query_as(
        r#"
        UPDATE maintenance SET end_notified = true
        WHERE NOT end_notified AND status <> 'cancelled' AND scheduled_end <= now()
        RETURNING id, title, scheduled_start, scheduled_end, affected_services
        "#,
    )
    .fetch_all(db)
    .await?;
    for row in ended {
        if Utc::now() - row.scheduled_end < chrono::Duration::minutes(10) {
            notify(
                db,
                Event::MaintenanceCompleted {
                    id: row.id,
                    title: row.title,
                    services: row.affected_services.unwrap_or_default(),
                },
            );
        }
    }
    Ok(())
}
