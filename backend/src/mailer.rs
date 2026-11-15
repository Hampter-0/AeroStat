//! Sending email over SMTP. The settings only come from the environment, so
//! the password never passes through the panel or the database.

use std::env;
use std::fmt;
use std::sync::OnceLock;
use std::time::Duration;

use lettre::message::{header::ContentType, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Address, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

#[derive(Clone, Copy, PartialEq)]
pub enum Encryption {
    /// TLS from the first byte, usually port 465.
    Tls,
    /// Plain connection upgraded with STARTTLS, usually port 587.
    StartTls,
    /// No encryption at all. Only for a mail server on the same machine.
    None,
}

impl Encryption {
    pub fn label(self) -> &'static str {
        match self {
            Encryption::Tls => "tls",
            Encryption::StartTls => "starttls",
            Encryption::None => "none",
        }
    }
}

#[derive(Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub encryption: Encryption,
    pub username: Option<String>,
    password: Option<String>,
    pub from_address: Address,
    pub from_name: Option<String>,
}

impl fmt::Debug for SmtpConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SmtpConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("encryption", &self.encryption.label())
            .field("username", &self.username)
            .field("password_set", &self.password.is_some())
            .field("from_address", &self.from_address.to_string())
            .field("from_name", &self.from_name)
            .finish()
    }
}

fn var(name: &str) -> Option<String> {
    env::var(name).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}

impl SmtpConfig {
    /// `None` when SMTP_HOST is not set: email is simply off.
    pub fn from_env() -> anyhow::Result<Option<Self>> {
        let Some(host) = var("SMTP_HOST") else {
            return Ok(None);
        };

        let port: Option<u16> = match var("SMTP_PORT") {
            Some(text) => Some(text.parse().map_err(|_| anyhow::anyhow!("SMTP_PORT must be a port number"))?),
            None => None,
        };
        let encryption = match var("SMTP_ENCRYPTION").map(|text| text.to_lowercase()).as_deref() {
            Some("tls" | "ssl") => Encryption::Tls,
            Some("starttls") => Encryption::StartTls,
            Some("none") => Encryption::None,
            Some(other) => anyhow::bail!("SMTP_ENCRYPTION must be tls, starttls or none, not '{other}'"),
            None if port == Some(465) => Encryption::Tls,
            None => Encryption::StartTls,
        };
        let port = port.unwrap_or(match encryption {
            Encryption::Tls => 465,
            Encryption::StartTls => 587,
            Encryption::None => 25,
        });

        let username = var("SMTP_USERNAME");
        let password = env::var("SMTP_PASSWORD").ok().filter(|value| !value.is_empty());

        let from_text = var("SMTP_FROM_ADDRESS")
            .or_else(|| username.clone().filter(|name| name.contains('@')))
            .ok_or_else(|| anyhow::anyhow!("Set SMTP_FROM_ADDRESS, the address emails are sent from"))?;
        let from_address: Address = from_text
            .parse()
            .map_err(|_| anyhow::anyhow!("SMTP_FROM_ADDRESS is not a valid email address"))?;

        Ok(Some(Self {
            host,
            port,
            encryption,
            username,
            password,
            from_address,
            from_name: var("SMTP_FROM_NAME"),
        }))
    }

    pub fn password_set(&self) -> bool {
        self.password.is_some()
    }
}

static CONFIG: OnceLock<Option<SmtpConfig>> = OnceLock::new();

pub fn init(config: Option<SmtpConfig>) {
    let _ = CONFIG.set(config);
}

pub fn config() -> Option<&'static SmtpConfig> {
    CONFIG.get().and_then(|config| config.as_ref())
}

pub fn is_valid_address(text: &str) -> bool {
    text.parse::<Address>().is_ok()
}

pub struct Email {
    pub to: String,
    pub subject: String,
    pub html: String,
    pub text: String,
    /// Used as sender name when SMTP_FROM_NAME is not set.
    pub site_name: String,
}

/// Sends one email. Errors carry the mail server's answer, so the test button
/// can show why it failed.
pub async fn send(email: Email) -> anyhow::Result<()> {
    let Some(config) = config() else {
        anyhow::bail!("Email is not set up");
    };

    let from_name = config.from_name.clone().unwrap_or(email.site_name);
    let to: Mailbox = email
        .to
        .parse()
        .map_err(|_| anyhow::anyhow!("'{}' is not a valid email address", email.to))?;
    let message = Message::builder()
        .from(Mailbox::new(Some(from_name), config.from_address.clone()))
        .to(to)
        .subject(email.subject)
        .multipart(
            MultiPart::alternative()
                .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(email.text))
                .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(email.html)),
        )?;

    let builder = match config.encryption {
        Encryption::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)?,
        Encryption::StartTls => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)?,
        Encryption::None => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host),
    };
    let mut builder = builder.port(config.port).timeout(Some(Duration::from_secs(20)));
    if let (Some(username), Some(password)) = (&config.username, &config.password) {
        builder = builder.credentials(Credentials::new(username.clone(), password.clone()));
    }

    builder.build().send(message).await?;
    Ok(())
}
