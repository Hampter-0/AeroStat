//! Emails a user when something about their sign-in changes, so a stranger
//! with their password can't quietly change the account.

use sqlx::PgPool;

use crate::mailer;
use crate::site_settings;

pub enum Change {
    AppOn,
    AppOff,
    EmailCodesOn,
    EmailCodesOff,
    RecoveryCodes,
    PasswordChanged,
    PasswordReset,
    /// Sent to the old address, which no longer gets the account's mail.
    EmailChanged { new_address: Option<String> },
    PasskeyAdded { name: String },
    PasskeyRemoved { name: String },
    PasswordLoginOn,
    PasswordLoginOff,
    TwoFactorResetBy { admin: String },
    /// Someone else changed this account in the panel.
    ChangedBy { admin: String, what: &'static str },
}

impl Change {
    fn subject(&self) -> String {
        if let Change::ChangedBy { what, .. } = self {
            return format!("Your {what} was changed");
        }
        let text = match self {
            Change::AppOn => "Authenticator app turned on",
            Change::AppOff => "Authenticator app turned off",
            Change::EmailCodesOn => "Email codes turned on",
            Change::EmailCodesOff => "Email codes turned off",
            Change::RecoveryCodes => "New recovery codes made",
            Change::PasswordChanged => "Your password was changed",
            Change::PasswordReset => "Your password was reset",
            Change::EmailChanged { .. } => "Your email address was changed",
            Change::PasskeyAdded { .. } => "A passkey was added",
            Change::PasskeyRemoved { .. } => "A passkey was removed",
            Change::PasswordLoginOn => "Password sign-in turned on",
            Change::PasswordLoginOff => "Password sign-in turned off",
            Change::TwoFactorResetBy { .. } => "Your two-factor sign-in was reset",
            Change::ChangedBy { .. } => "Your account was changed",
        };
        text.to_string()
    }

    fn sentence(&self, site: &str) -> String {
        match self {
            Change::AppOn => format!("The authenticator app was turned on for your {site} account."),
            Change::AppOff => format!("The authenticator app was turned off for your {site} account."),
            Change::EmailCodesOn => format!("Sign-in codes by email were turned on for your {site} account."),
            Change::EmailCodesOff => format!("Sign-in codes by email were turned off for your {site} account."),
            Change::RecoveryCodes => {
                format!("New recovery codes were made for your {site} account. The old ones no longer work.")
            }
            Change::PasswordChanged => {
                format!("The password of your {site} account was changed. Your other sessions were signed out.")
            }
            Change::PasswordReset => {
                format!("The password of your {site} account was reset with a link sent to this address.")
            }
            Change::EmailChanged { new_address: Some(address) } => format!(
                "The email address of your {site} account was changed to {}. This address no longer gets its mail.",
                hint(address)
            ),
            Change::EmailChanged { new_address: None } => format!(
                "The email address was removed from your {site} account. This address no longer gets its mail."
            ),
            Change::PasskeyAdded { name } => format!("A passkey called \"{name}\" was added to your {site} account."),
            Change::PasskeyRemoved { name } => {
                format!("The passkey called \"{name}\" was removed from your {site} account.")
            }
            Change::PasswordLoginOn => format!("Signing in with a password was turned on for your {site} account."),
            Change::PasswordLoginOff => format!(
                "Signing in with a password was turned off for your {site} account. Only passkeys work now."
            ),
            Change::ChangedBy { admin, what } => {
                format!("{admin} changed the {what} of your {site} account in the panel.")
            }
            Change::TwoFactorResetBy { admin } => format!(
                "{admin} reset the two-factor sign-in of your {site} account. You sign in with just your password until you set it up again."
            ),
        }
    }
}

/// Shows enough of an address to recognise it without giving it away.
fn hint(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let first: String = local.chars().take(1).collect();
            format!("{first}…@{domain}")
        }
        None => "another address".to_string(),
    }
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// Sends the email in the background. It goes to the user's address, or to
/// `to` when given (the old address after an email change). Nothing is sent
/// when email isn't set up or there is no address; failures are only logged.
pub fn notify(db: &PgPool, user_id: i64, change: Change, ip: Option<String>, to: Option<String>) {
    if mailer::config().is_none() {
        return;
    }
    let db = db.clone();
    tokio::spawn(async move {
        if let Err(e) = send(&db, user_id, change, ip, to).await {
            tracing::warn!("Could not send the security email to user {user_id}: {e:#}");
        }
    });
}

async fn send(db: &PgPool, user_id: i64, change: Change, ip: Option<String>, to: Option<String>) -> anyhow::Result<()> {
    let row: Option<(String, Option<String>)> = sqlx::query_as("SELECT username, email FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(db)
        .await?;
    let Some((username, email)) = row else {
        return Ok(());
    };
    let Some(address) = to.or(email) else {
        return Ok(());
    };

    let settings = site_settings::all(db).await.unwrap_or_default();
    let site = settings
        .get(site_settings::SITE_NAME)
        .cloned()
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "AeroStat".to_string());
    let timezone = site_settings::timezone(db).await;
    let when = chrono::Utc::now().with_timezone(&timezone).format("%-d %b %Y, %H:%M %Z").to_string();
    let profile = site_settings::public_url(db)
        .await
        .map(|url| format!("{}/manage/profile", url.trim_end_matches('/')));

    let sentence = change.sentence(&site);
    let mut facts = vec![format!("When: {when}")];
    if let Some(ip) = &ip {
        facts.push(format!("IP address: {ip}"));
    }
    let warning = "If this wasn't you, change your password right away and sign out your other sessions on your profile.";

    let mut text = format!("Hi {username},\n\n{sentence}\n\n{}\n\n{warning}", facts.join("\n"));
    if let Some(link) = &profile {
        text.push_str(&format!("\n\n{link}"));
    }

    let facts_html: String = facts
        .iter()
        .map(|fact| format!(r#"<div style="margin:0 0 4px">{}</div>"#, escape(fact)))
        .collect();
    let button = match &profile {
        Some(link) => format!(
            r#"<p style="margin:0 0 20px"><a href="{}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">Open your profile</a></p>"#,
            escape(link)
        ),
        None => String::new(),
    };
    let html = format!(
        r#"<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:480px;margin:0 auto;padding:28px 32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<p style="margin:0 0 12px;font-size:15px;color:#334155">Hi {name},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155">{sentence}</p>
<div style="margin:0 0 20px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569">{facts_html}</div>
{button}
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">{warning}</p>
</div></body></html>"#,
        name = escape(&username),
        sentence = escape(&sentence),
    );

    mailer::send(mailer::Email {
        to: address,
        subject: format!("[{site}] {}", change.subject()),
        html,
        text,
        site_name: site,
    })
    .await
}
