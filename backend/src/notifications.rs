//! Notifications about services, incidents and maintenance. Each event goes
//! to the Discord webhook, by email to panel users who asked for it, and to
//! the bell in the panel.

use std::time::Duration;

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use rand::RngCore;
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::mailer;
use crate::site_settings;

const USER_AGENT: &str = concat!("AeroStat/", env!("CARGO_PKG_VERSION"), " (+https://github.com/Hampter-0/AeroStat)");

pub const EVENT_KINDS: [&str; 10] = [
    "service_down",
    "service_up",
    "service_certificate",
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
        /// Why the last check failed, in words.
        error: Option<String>,
        since: DateTime<Utc>,
    },
    CertificateExpiring {
        service_id: String,
        expires_at: DateTime<Utc>,
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
            Event::CertificateExpiring { .. } => "service_certificate",
            Event::IncidentCreated { .. } => "incident_created",
            Event::IncidentUpdated { status, .. } if status == "resolved" => "incident_resolved",
            Event::IncidentUpdated { .. } => "incident_updated",
            Event::MaintenanceScheduled { .. } => "maintenance_scheduled",
            Event::MaintenanceStarted { .. } => "maintenance_started",
            Event::MaintenanceCompleted { .. } => "maintenance_completed",
            Event::MaintenanceCancelled { .. } => "maintenance_cancelled",
        }
    }

    pub fn permission(&self) -> &'static str {
        permission_for(self.kind())
    }
}

/// The panel permission someone needs to get this kind of event by email.
pub fn permission_for(kind: &str) -> &'static str {
    if kind.starts_with("service_") {
        "services.view"
    } else if kind.starts_with("incident_") {
        "incidents.view"
    } else {
        "maintenance.view"
    }
}

pub struct NotificationSettings {
    pub discord_webhook_url: Option<String>,
    /// The status page address from the site settings, for links and pictures.
    pub public_url: Option<String>,
    pub events: Vec<String>,
}

pub async fn load(db: &PgPool) -> anyhow::Result<NotificationSettings> {
    let (discord_webhook_url, events): (Option<String>, Vec<String>) =
        sqlx::query_as("SELECT discord_webhook_url, events FROM notification_settings")
            .fetch_one(db)
            .await?;
    Ok(NotificationSettings {
        discord_webhook_url,
        public_url: site_settings::public_url(db).await,
        events,
    })
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
/// for Discord or the mail server.
pub fn notify(db: &PgPool, event: Event) {
    notify_by(db, event, None);
}

/// Like `notify`, for something a panel user did. They don't get it in their
/// own bell.
pub fn notify_by(db: &PgPool, event: Event, actor: Option<i64>) {
    let db = db.clone();
    tokio::spawn(async move {
        let settings = match load(&db).await {
            Ok(settings) => settings,
            Err(e) => {
                tracing::warn!("Could not load notification settings: {e}");
                return;
            }
        };
        if let Err(e) = deliver_panel_event(&db, &settings, &event, actor).await {
            tracing::warn!("Could not save panel notifications: {e}");
        }
        let image = card_image(&db, &settings, event_card(&db, &event).await).await;
        if let Err(e) = deliver_discord(&db, &settings, &event, image.clone()).await {
            tracing::warn!("Could not send a Discord notification: {e}");
        }
        if let Err(e) = deliver_email(&db, &settings, &event, image).await {
            tracing::warn!("Could not send email notifications: {e}");
        }
    });
}

async fn deliver_discord(
    db: &PgPool,
    settings: &NotificationSettings,
    event: &Event,
    image: Option<String>,
) -> anyhow::Result<()> {
    if !settings.events.iter().any(|kind| kind == event.kind()) {
        return Ok(());
    }
    let Some(webhook) = settings.discord_webhook_url.as_deref() else {
        return Ok(());
    };
    let site = site_name(db).await;
    let content = content(db, settings, event, &Times::Discord, image).await;
    send_discord(webhook, &discord_embed(&site, content)).await
}

/// Mails every panel user who turned this event on and is allowed to see it.
/// Each person gets their own email, so addresses are never shared.
async fn deliver_email(
    db: &PgPool,
    settings: &NotificationSettings,
    event: &Event,
    image: Option<String>,
) -> anyhow::Result<()> {
    if mailer::config().is_none() {
        return Ok(());
    }
    let recipients: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT email FROM users
        WHERE email IS NOT NULL AND $1 = ANY(email_events) AND (user_is_super(id) OR $2 = ANY(user_permissions(id)))
        "#,
    )
    .bind(event.kind())
    .bind(event.permission())
    .fetch_all(db)
    .await?;
    if recipients.is_empty() {
        return Ok(());
    }

    let site = site_name(db).await;
    let times = Times::Email(site_settings::timezone(db).await);
    let content = content(db, settings, event, &times, image).await;
    let (html, text) = email_body(&site, &content, settings);
    for (to,) in recipients {
        let email = mailer::Email {
            to: to.clone(),
            subject: format!("[{site}] {}", content.title),
            html: html.clone(),
            text: text.clone(),
            site_name: site.clone(),
        };
        if let Err(e) = mailer::send(email).await {
            tracing::warn!("Could not email {to}: {e}");
        }
    }
    Ok(())
}

/// What a notification in the bell says and where it leads.
struct PanelItem {
    kind: &'static str,
    title: String,
    body: String,
    tone: &'static str,
    path: Option<String>,
    important: bool,
}

fn tone_name(color: u32) -> &'static str {
    match color {
        RED => "red",
        GREEN => "green",
        YELLOW => "amber",
        BLUE => "blue",
        _ => "grey",
    }
}

fn panel_path(event: &Event) -> String {
    match event {
        Event::ServiceDown { service_id, .. }
        | Event::ServiceUp { service_id, .. }
        | Event::CertificateExpiring { service_id, .. } => format!("/manage/services/{service_id}"),
        Event::IncidentCreated { id, .. } | Event::IncidentUpdated { id, .. } => format!("/manage/incidents/{id}"),
        Event::MaintenanceScheduled { id, .. }
        | Event::MaintenanceStarted { id, .. }
        | Event::MaintenanceCompleted { id, .. }
        | Event::MaintenanceCancelled { id, .. } => format!("/manage/maintenance/{id}"),
    }
}

/// Outages, critical incidents and security problems are marked important.
fn is_important(event: &Event) -> bool {
    match event {
        Event::ServiceDown { .. } => true,
        Event::IncidentCreated { severity, .. } => severity == "critical",
        _ => false,
    }
}

async fn deliver_panel_event(
    db: &PgPool,
    settings: &NotificationSettings,
    event: &Event,
    actor: Option<i64>,
) -> anyhow::Result<()> {
    let times = Times::Email(site_settings::timezone(db).await);
    let content = content(db, settings, event, &times, None).await;
    let item = PanelItem {
        kind: event.kind(),
        title: content.title,
        body: content.description,
        tone: tone_name(content.color),
        path: Some(panel_path(event)),
        important: is_important(event),
    };
    save_panel(db, item, Some(event.permission()), actor).await
}

/// Saves the notification for everyone who may see it and kept this kind on.
/// `permission` None means super users only. Old ones are removed after 30
/// days so the table stays small.
async fn save_panel(db: &PgPool, item: PanelItem, permission: Option<&str>, actor: Option<i64>) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO panel_notifications (user_id, kind, title, body, tone, path, important)
        SELECT id, $1, $2, $3, $4, $5, $6 FROM users
        WHERE panel_enabled AND $1 = ANY(panel_events) AND id IS DISTINCT FROM $7
          AND (user_is_super(id) OR ($8::text IS NOT NULL AND $8 = ANY(user_permissions(id))))
        "#,
    )
    .bind(item.kind)
    .bind(item.title.chars().take(256).collect::<String>())
    .bind(item.body.chars().take(500).collect::<String>())
    .bind(item.tone)
    .bind(item.path)
    .bind(item.important)
    .bind(actor)
    .bind(permission)
    .execute(db)
    .await?;
    sqlx::query("DELETE FROM panel_notifications WHERE created_at < now() - interval '30 days'")
        .execute(db)
        .await?;
    Ok(())
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

/// The picture shown with a message. The frontend draws it at /og/card/<id>.
struct Card {
    icon: &'static str,
    color: &'static str,
    headline: String,
    subline: String,
}

/// Saves the card and returns its address. Stored once, so the picture keeps
/// showing what happened when the message was sent, not today's status.
async fn card_image(db: &PgPool, settings: &NotificationSettings, card: Card) -> Option<String> {
    settings.public_url.as_ref()?;
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let id = hex::encode(bytes);
    let saved = sqlx::query("INSERT INTO share_cards (id, icon, color, headline, subline) VALUES ($1, $2, $3, $4, $5)")
        .bind(&id)
        .bind(card.icon)
        .bind(card.color)
        .bind(card.headline.chars().take(200).collect::<String>())
        .bind(card.subline.chars().take(200).collect::<String>())
        .execute(db)
        .await;
    if let Err(e) = saved {
        tracing::warn!("Could not save the picture for a notification: {e}");
        return None;
    }
    link(settings, &format!("/og/card/{id}"))
}

async fn event_card(db: &PgPool, event: &Event) -> Card {
    let times = Times::Email(site_settings::timezone(db).await);
    match event {
        Event::ServiceDown { service_id, since, .. } => {
            let name = service_names(db, std::slice::from_ref(service_id)).await.remove(0);
            Card {
                icon: "cross",
                color: "red",
                headline: format!("{name} is down"),
                subline: format!("Down since {}", times.format(*since)),
            }
        }
        Event::ServiceUp { service_id, down_since } => {
            let name = service_names(db, std::slice::from_ref(service_id)).await.remove(0);
            let seconds = (Utc::now() - *down_since).num_seconds().max(0);
            Card {
                icon: "check",
                color: "green",
                headline: format!("{name} is back up"),
                subline: format!("It was down for {}", duration_text(seconds)),
            }
        }
        Event::CertificateExpiring { service_id, expires_at } => {
            let name = service_names(db, std::slice::from_ref(service_id)).await.remove(0);
            Card {
                icon: "alert",
                color: "amber",
                headline: format!("Certificate of {name} runs out soon"),
                subline: format!("Valid until {}", times.format(*expires_at)),
            }
        }
        Event::IncidentCreated { title, status, .. } => Card {
            icon: "alert",
            color: "amber",
            headline: title.clone(),
            subline: format!("New incident · {}", capitalize(status)),
        },
        Event::IncidentUpdated { title, status, .. } if status == "resolved" => Card {
            icon: "check",
            color: "green",
            headline: title.clone(),
            subline: "Incident · Resolved".to_string(),
        },
        Event::IncidentUpdated { title, status, .. } => Card {
            icon: "alert",
            color: "amber",
            headline: title.clone(),
            subline: format!("Ongoing incident · {}", capitalize(status)),
        },
        Event::MaintenanceScheduled { title, start, end, .. } => Card {
            icon: "wrench",
            color: "blue",
            headline: title.clone(),
            subline: format!("Scheduled maintenance · {} to {}", times.format(*start), times.format(*end)),
        },
        Event::MaintenanceStarted { title, end, .. } => Card {
            icon: "wrench",
            color: "blue",
            headline: title.clone(),
            subline: format!("Ongoing maintenance · until {}", times.format(*end)),
        },
        Event::MaintenanceCompleted { title, .. } => Card {
            icon: "check",
            color: "green",
            headline: title.clone(),
            subline: "Completed maintenance".to_string(),
        },
        Event::MaintenanceCancelled { title, .. } => Card {
            icon: "wrench",
            color: "grey",
            headline: title.clone(),
            subline: "Cancelled maintenance".to_string(),
        },
    }
}

async fn test_card(db: &PgPool) -> Card {
    Card {
        icon: "check",
        color: "green",
        headline: "Notifications are working".to_string(),
        subline: site_name(db).await,
    }
}

/// Discord shows `<t:…>` in each reader's own time zone; an email gets the
/// time zone of the status page.
enum Times {
    Discord,
    Email(Tz),
}

impl Times {
    fn format(&self, at: DateTime<Utc>) -> String {
        match self {
            Times::Discord => format!("<t:{}:f>", at.timestamp()),
            Times::Email(tz) => at.with_timezone(tz).format("%-d %b %Y, %H:%M %Z").to_string(),
        }
    }
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

struct Field {
    name: String,
    value: String,
    inline: bool,
}

fn field(name: &str, value: String, inline: bool) -> Field {
    Field {
        name: name.to_string(),
        value,
        inline,
    }
}

/// What a message says, before it is shaped for Discord or email.
struct Content {
    title: String,
    description: String,
    color: u32,
    url: Option<String>,
    image: Option<String>,
    fields: Vec<Field>,
}

/// "200 or 204" for the codes a service is expected to answer with.
async fn expected_codes(db: &PgPool, service_id: &str) -> Option<String> {
    let codes: Vec<i32> = sqlx::query_scalar("SELECT expected_status FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten()?;
    if codes.is_empty() {
        return None;
    }
    let texts: Vec<String> = codes.iter().map(|code| code.to_string()).collect();
    Some(texts.join(" or "))
}

async fn content(
    db: &PgPool,
    settings: &NotificationSettings,
    event: &Event,
    times: &Times,
    image: Option<String>,
) -> Content {
    let mut fields: Vec<Field> = Vec::new();

    let (title, description, color, url, services) = match event {
        Event::ServiceDown { service_id, status_code, error, since } => {
            let name = service_names(db, std::slice::from_ref(service_id)).await.remove(0);
            let wrong_status = error.as_deref().map(|text| text.starts_with("It answered with status")).unwrap_or(true);
            let reason = match (status_code, expected_codes(db, service_id).await, error) {
                (Some(code), Some(expected), _) if wrong_status => {
                    format!("It answered with status {code} instead of {expected}.")
                }
                (_, _, Some(text)) => text.clone(),
                (Some(code), _, None) => format!("It answered with status {code}."),
                (None, _, None) => "It did not answer.".to_string(),
            };
            (
                format!("{name} is down"),
                format!("{reason} Down since {}.", times.format(*since)),
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
        Event::CertificateExpiring { service_id, expires_at } => {
            let name = service_names(db, std::slice::from_ref(service_id)).await.remove(0);
            let days = (*expires_at - Utc::now()).num_days().max(0);
            let left = match days {
                0 => "less than a day".to_string(),
                1 => "1 day".to_string(),
                _ => format!("{days} days"),
            };
            (
                format!("Certificate of {name} runs out soon"),
                format!(
                    "The HTTPS certificate is valid until {}, {left} from now. Renew it before then, or visitors get a security warning and the check fails.",
                    times.format(*expires_at)
                ),
                YELLOW,
                link(settings, "/"),
                Vec::new(),
            )
        }
        Event::IncidentCreated { id, title, status, severity, message, services } => {
            fields.push(field("Status", capitalize(status), true));
            fields.push(field("Severity", capitalize(severity), true));
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
                fields.push(field("Status", capitalize(status), true));
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
            format!("From {} to {}.", times.format(*start), times.format(*end)),
            BLUE,
            link(settings, &format!("/maintenance/{id}")),
            services.clone(),
        ),
        Event::MaintenanceStarted { id, title, end, services } => (
            format!("Maintenance started: {title}"),
            format!("Planned to end at {}.", times.format(*end)),
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
        fields.push(field("Affected services", names.join(", "), false));
    }

    Content {
        title: title.chars().take(256).collect(),
        description: description.chars().take(2000).collect(),
        color,
        url,
        image,
        fields,
    }
}

async fn test_content(db: &PgPool, settings: &NotificationSettings, channel: &str) -> Content {
    Content {
        title: "Notifications are working".to_string(),
        description: format!(
            "This {channel} will get a message when a service goes down or comes back, and when an incident or maintenance is posted."
        ),
        color: GREEN,
        url: link(settings, "/"),
        image: card_image(db, settings, test_card(db).await).await,
        fields: Vec::new(),
    }
}

fn discord_embed(site: &str, content: Content) -> Value {
    let fields: Vec<Value> = content
        .fields
        .iter()
        .map(|f| json!({ "name": f.name, "value": f.value, "inline": f.inline }))
        .collect();
    let mut embed = json!({
        "title": content.title,
        "description": content.description,
        "color": content.color,
        "fields": fields,
        "footer": { "text": site },
        "timestamp": Utc::now().to_rfc3339(),
    });
    if let Some(url) = content.url {
        embed["url"] = json!(url);
    }
    if let Some(image) = content.image {
        embed["image"] = json!({ "url": image });
    }
    json!({ "username": site, "embeds": [embed] })
}

/// A sample message for the "Send test message" button.
pub async fn test_payload(db: &PgPool, settings: &NotificationSettings) -> Value {
    let site = site_name(db).await;
    discord_embed(&site, test_content(db, settings, "channel").await)
}

/// A sample email for the "Send test email" button.
pub async fn test_email(db: &PgPool, to: String) -> anyhow::Result<mailer::Email> {
    let settings = load(db).await?;
    let site = site_name(db).await;
    let content = test_content(db, &settings, "address").await;
    let (html, text) = email_body(&site, &content, &settings);
    Ok(mailer::Email {
        to,
        subject: format!("[{site}] {}", content.title),
        html,
        text,
        site_name: site,
    })
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// A plain HTML email that also reads well in clients that block images.
fn email_body(site: &str, content: &Content, settings: &NotificationSettings) -> (String, String) {
    let color = format!("#{:06X}", content.color);
    let title = escape(&content.title);
    let description = escape(&content.description).replace('\n', "<br>");

    let mut image_row = String::new();
    if let Some(image) = &content.image {
        let img = format!(
            r#"<img src="{}" alt="{title}" width="560" style="display:block;width:100%;height:auto;border:0">"#,
            escape(image)
        );
        let linked = match &content.url {
            Some(url) => format!(r#"<a href="{}">{img}</a>"#, escape(url)),
            None => img,
        };
        image_row = format!(r#"<tr><td style="border-bottom:1px solid #e2e8f0">{linked}</td></tr>"#);
    }

    let mut fields_html = String::new();
    if !content.fields.is_empty() {
        let rows: String = content
            .fields
            .iter()
            .map(|f| {
                format!(
                    r#"<tr><td style="padding:8px 16px 8px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;width:1%;white-space:nowrap;vertical-align:top">{}</td><td style="padding:8px 0;border-top:1px solid #e2e8f0;font-size:14px;color:#0f172a;word-break:break-word;overflow-wrap:anywhere">{}</td></tr>"#,
                    escape(&f.name),
                    escape(&f.value)
                )
            })
            .collect();
        fields_html = format!(
            r#"<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-bottom:1px solid #e2e8f0">{rows}</table>"#
        );
    }

    let mut button = String::new();
    if let Some(url) = &content.url {
        button = format!(
            r#"<a href="{}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">View on the status page</a>"#,
            escape(url)
        );
    }

    let mut manage = String::new();
    if let Some(url) = link(settings, "/manage/profile") {
        manage = format!(r#" <a href="{}" style="color:#64748b">Change your notifications</a>"#, escape(&url));
    }

    let html = format!(
        r#"<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
<tr><td style="height:4px;background:{color};font-size:0;line-height:0">&nbsp;</td></tr>
{image_row}
<tr><td style="padding:28px 32px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a">{title}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155">{description}</p>
{fields_html}{button}
</td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#64748b">You get this email because you turned on email notifications on {site_html}.{manage}</p>
</td></tr>
</table>
</body>
</html>"#,
        site_html = escape(site),
    );

    let mut text = format!("{}\n\n{}\n", content.title, content.description);
    for f in &content.fields {
        text.push_str(&format!("\n{}: {}", f.name, f.value));
    }
    if !content.fields.is_empty() {
        text.push('\n');
    }
    if let Some(url) = &content.url {
        text.push_str(&format!("\nView on the status page: {url}\n"));
    }
    text.push_str(&format!("\n--\nYou get this email because you turned on email notifications on {site}."));
    if let Some(url) = link(settings, "/manage/profile") {
        text.push_str(&format!("\nChange your notifications: {url}"));
    }
    (html, text)
}

/// Called after every check. Sends "down" once the set number of checks in a
/// row failed (two by default, so a single hiccup stays quiet) and "up" on the
/// first good check after such an outage.
pub async fn after_check(db: &PgPool, service_id: &str) {
    let needed = crate::site_settings::down_after_checks(db).await.max(1) as usize;
    let rows: Vec<(String, DateTime<Utc>, Option<i32>, Option<String>)> = match sqlx::query_as(
        "SELECT status, checked_at, status_code, error FROM metrics WHERE service_id = $1 ORDER BY checked_at DESC LIMIT $2",
    )
    .bind(service_id)
    .bind(needed as i64 + 1)
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

    let all_offline = |from: usize, to: usize| (from..to).all(|index| offline(index));

    if all_offline(0, needed) && (rows.len() <= needed || online(needed)) {
        notify(
            db,
            Event::ServiceDown {
                service_id: service_id.to_string(),
                status_code: rows[0].2,
                error: rows[0].3.clone(),
                since: rows[needed - 1].1,
            },
        );
    } else if online(0) && all_offline(1, needed + 1) {
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
        let down_since = since.and_then(|(at,)| at).unwrap_or(rows[needed].1);
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

/// Email-only notices for people who run the panel. They never go to Discord,
/// since a channel is often public.
pub const ADMIN_EVENT_KINDS: [&str; 5] = [
    "admin_backup_failed",
    "admin_update_available",
    "admin_account_locked",
    "admin_users",
    "admin_security",
];

/// The permission someone needs to get an admin notice. None means super
/// users only, for changes to who can do everything.
pub fn admin_permission(kind: &str) -> Option<&'static str> {
    match kind {
        "admin_backup_failed" => Some("system.backups"),
        "admin_update_available" => Some("system.view"),
        "admin_account_locked" | "admin_users" => Some("users.view"),
        _ => None,
    }
}

pub struct AdminNotice {
    pub kind: &'static str,
    pub title: String,
    pub description: String,
    pub fields: Vec<(&'static str, String)>,
    /// A page in the panel, like "/manage/users".
    pub path: &'static str,
    /// Whoever caused it doesn't get an email about their own action.
    pub actor: Option<i64>,
}

/// Puts the notice in the bell and mails it, in the background, to everyone
/// who turned it on and may see it.
pub fn notify_admins(db: &PgPool, notice: AdminNotice) {
    let db = db.clone();
    tokio::spawn(async move {
        let item = PanelItem {
            kind: notice.kind,
            title: notice.title.clone(),
            body: notice.description.clone(),
            tone: tone_name(admin_color(notice.kind)),
            path: Some(notice.path.to_string()),
            important: matches!(notice.kind, "admin_backup_failed" | "admin_account_locked" | "admin_security"),
        };
        if let Err(e) = save_panel(&db, item, admin_permission(notice.kind), notice.actor).await {
            tracing::warn!("Could not save panel notifications: {e}");
        }
        if mailer::config().is_none() {
            return;
        }
        if let Err(e) = deliver_admin(&db, notice).await {
            tracing::warn!("Could not send an admin email: {e}");
        }
    });
}

fn admin_color(kind: &str) -> u32 {
    match kind {
        "admin_update_available" => BLUE,
        "admin_users" => GREY,
        _ => RED,
    }
}

async fn deliver_admin(db: &PgPool, notice: AdminNotice) -> anyhow::Result<()> {
    let recipients: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT email FROM users
        WHERE email IS NOT NULL AND $1 = ANY(email_events) AND id IS DISTINCT FROM $3
          AND (user_is_super(id) OR ($2::text IS NOT NULL AND $2 = ANY(user_permissions(id))))
        "#,
    )
    .bind(notice.kind)
    .bind(admin_permission(notice.kind))
    .bind(notice.actor)
    .fetch_all(db)
    .await?;
    if recipients.is_empty() {
        return Ok(());
    }

    let settings = load(db).await?;
    let site = site_name(db).await;
    let color = admin_color(notice.kind);
    let content = Content {
        title: notice.title.chars().take(256).collect(),
        description: notice.description.chars().take(2000).collect(),
        color,
        url: link(&settings, notice.path),
        image: None,
        fields: notice.fields.into_iter().map(|(name, value)| field(name, value, true)).collect(),
    };
    let (html, text) = email_body(&site, &content, &settings);
    let html = html.replace("View on the status page", "Open the panel");
    let text = text.replace("View on the status page", "Open the panel");
    for (to,) in recipients {
        let email = mailer::Email {
            to: to.clone(),
            subject: format!("[{site}] {}", content.title),
            html: html.clone(),
            text: text.clone(),
            site_name: site.clone(),
        };
        if let Err(e) = mailer::send(email).await {
            tracing::warn!("Could not email {to}: {e}");
        }
    }
    Ok(())
}
