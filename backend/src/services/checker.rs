use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use hickory_resolver::proto::rr::{RData, RecordType};
use hickory_resolver::TokioResolver;
use tokio::net::TcpStream;
use tokio_rustls::rustls::pki_types::ServerName;
use tokio_rustls::rustls::{ClientConfig, RootCertStore};
use tokio_rustls::TlsConnector;

use crate::models::CheckResult;

const TIMEOUT: Duration = Duration::from_secs(10);
/// A keyword is only searched in the first part of a page, so a huge
/// download can't tie up the checker.
const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
/// How much of a failed answer is kept for the check log.
const DETAIL_BODY_BYTES: usize = 2 * 1024;
/// Headers worth seeing when a check fails.
const DETAIL_HEADERS: [&str; 6] = ["content-type", "content-length", "server", "location", "retry-after", "cf-ray"];

pub const CHECK_TYPES: [&str; 11] = [
    "http", "tcp", "dns", "ping", "docker", "postgres", "mysql", "redis", "minecraft", "bedrock", "source",
];
pub const DNS_RECORD_TYPES: [&str; 5] = ["A", "AAAA", "CNAME", "MX", "TXT"];

/// A service as read from the database
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CheckableService {
    pub id: String,
    pub check_type: String,
    pub url: String,
    pub expected_status: Vec<i32>,
    pub keyword: Option<String>,
    pub keyword_absent: bool,
    pub dns_record_type: Option<String>,
    pub dns_expected: Option<String>,
    pub cert_warn_days: Option<i32>,
    pub cert_checked_at: Option<DateTime<Utc>>,
    /// The address of the chosen Docker host; None means the default one.
    pub docker_address: Option<String>,
}

/// Performs a single check against one service and returns the result. None
/// when there is no answer yet, like a container that is still starting.
pub async fn check_service(client: &reqwest::Client, service: &CheckableService) -> Option<CheckResult> {
    let start = Instant::now();
    let outcome = match service.check_type.as_str() {
        "tcp" => check_tcp(&service.url).await,
        "dns" => check_dns(service).await,
        "http" => check_http(client, service).await,
        "docker" => {
            let address = service.docker_address.clone().unwrap_or_else(crate::docker::default_address);
            match crate::docker::container_status(&address, &service.url).await {
                Ok(true) => Ok(None),
                Ok(false) => return None,
                Err(reason) => Err(failed(reason)),
            }
        }
        other => super::probes::run(other, &service.url).await.map(|_| None).map_err(failed),
    };
    let response_time_ms = start.elapsed().as_millis() as i32;

    let (status, status_code, error, details) = match outcome {
        Ok(code) => ("online", code, None, None),
        Err(failure) => ("offline", failure.status_code, Some(failure.reason), failure.details),
    };
    Some(CheckResult {
        service_id: service.id.clone(),
        status: status.into(),
        response_time_ms,
        status_code,
        error,
        details,
    })
}

struct Failure {
    status_code: Option<i32>,
    reason: String,
    details: Option<String>,
}

fn failed(reason: impl Into<String>) -> Failure {
    Failure {
        status_code: None,
        reason: reason.into(),
        details: None,
    }
}

/// The status line, the useful headers and the start of the body.
fn answer_details(status: reqwest::StatusCode, headers: &reqwest::header::HeaderMap, body: &str) -> String {
    let mut text = format!("HTTP {}\n", status);
    for name in DETAIL_HEADERS {
        if let Some(value) = headers.get(name).and_then(|value| value.to_str().ok()) {
            text.push_str(&format!("{name}: {value}\n"));
        }
    }
    let mut excerpt: String = body.chars().take(DETAIL_BODY_BYTES).collect();
    if body.len() > excerpt.len() {
        excerpt.push_str("\n…");
    }
    if !excerpt.trim().is_empty() {
        text.push('\n');
        text.push_str(excerpt.trim());
    }
    text
}

/// Every layer of a request error, for the check log.
fn error_chain(error: &reqwest::Error) -> String {
    let mut parts = vec![error.to_string()];
    let mut source = std::error::Error::source(error);
    while let Some(inner) = source {
        parts.push(inner.to_string());
        source = inner.source();
    }
    parts.join("\ncaused by: ")
}

/// Status code on success. Fails on another code, no answer, or a keyword
/// that is missing (or present when it must not be).
async fn check_http(client: &reqwest::Client, service: &CheckableService) -> Result<Option<i32>, Failure> {
    let response = client
        .get(&service.url)
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| Failure {
            status_code: None,
            reason: http_error(&e),
            details: Some(error_chain(&e)),
        })?;
    let status = response.status();
    let headers = response.headers().clone();
    let code = status.as_u16() as i32;
    if !service.expected_status.contains(&code) {
        let body = read_body(response).await.unwrap_or_default();
        return Err(Failure {
            status_code: Some(code),
            reason: format!("It answered with status {code}."),
            details: Some(answer_details(status, &headers, &body)),
        });
    }

    let Some(keyword) = service.keyword.as_deref().filter(|word| !word.is_empty()) else {
        return Ok(Some(code));
    };
    let body = read_body(response).await.map_err(|e| Failure {
        status_code: Some(code),
        reason: "The page could not be read to look for the keyword.".into(),
        details: Some(e.to_string()),
    })?;
    let found = body.to_lowercase().contains(&keyword.to_lowercase());
    if found && service.keyword_absent {
        return Err(Failure {
            status_code: Some(code),
            reason: format!("The page contains \"{keyword}\"."),
            details: Some(answer_details(status, &headers, &body)),
        });
    }
    if !found && !service.keyword_absent {
        return Err(Failure {
            status_code: Some(code),
            reason: format!("The page does not contain \"{keyword}\"."),
            details: Some(answer_details(status, &headers, &body)),
        });
    }
    Ok(Some(code))
}

fn http_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "It did not answer within 10 seconds.".into();
    }
    let mut text = error.to_string();
    let mut source = std::error::Error::source(error);
    while let Some(inner) = source {
        text = inner.to_string();
        source = inner.source();
    }
    let lower = text.to_lowercase();
    if lower.contains("certificate") {
        return format!("The certificate is not valid: {text}.");
    }
    if lower.contains("dns") || lower.contains("resolve") || lower.contains("no such host") {
        return "The address could not be found.".into();
    }
    if lower.contains("refused") {
        return "The connection was refused.".into();
    }
    "It did not answer.".into()
}

async fn read_body(mut response: reqwest::Response) -> anyhow::Result<String> {
    let mut bytes: Vec<u8> = Vec::new();
    while let Some(chunk) = tokio::time::timeout(TIMEOUT, response.chunk()).await?? {
        bytes.extend_from_slice(&chunk);
        if bytes.len() >= MAX_BODY_BYTES {
            bytes.truncate(MAX_BODY_BYTES);
            break;
        }
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// Up when a connection to host:port opens.
async fn check_tcp(target: &str) -> Result<Option<i32>, Failure> {
    match tokio::time::timeout(TIMEOUT, TcpStream::connect(target)).await {
        Ok(Ok(_)) => Ok(None),
        Ok(Err(e)) if e.kind() == std::io::ErrorKind::ConnectionRefused => {
            Err(failed("The connection was refused."))
        }
        Ok(Err(e)) => Err(failed(format!("The connection failed: {e}."))),
        Err(_) => Err(failed("It did not answer within 10 seconds.")),
    }
}

/// Up when the name has records of the chosen type, and one of them matches
/// the expected value when one is set.
async fn check_dns(service: &CheckableService) -> Result<Option<i32>, Failure> {
    let kind = service.dns_record_type.as_deref().unwrap_or("A");
    let record_type = match kind {
        "AAAA" => RecordType::AAAA,
        "CNAME" => RecordType::CNAME,
        "MX" => RecordType::MX,
        "TXT" => RecordType::TXT,
        _ => RecordType::A,
    };
    let resolver = TokioResolver::builder_tokio()
        .map_err(|e| failed(format!("DNS could not be set up: {e}.")))?
        .build();
    let lookup = tokio::time::timeout(TIMEOUT, resolver.lookup(service.url.as_str(), record_type))
        .await
        .map_err(|_| failed("DNS did not answer within 10 seconds."))?
        .map_err(|e| {
            if e.is_no_records_found() {
                failed(format!("There are no {kind} records."))
            } else {
                failed(format!("The lookup failed: {e}."))
            }
        })?;

    let values: Vec<String> = lookup
        .record_iter()
        .filter(|record| record.record_type() == record_type)
        .filter_map(|record| record_value(record.data()))
        .collect();
    if values.is_empty() {
        return Err(failed(format!("There are no {kind} records.")));
    }
    let Some(expected) = service.dns_expected.as_deref().map(normalize).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if values.iter().any(|value| normalize(value) == expected) {
        return Ok(None);
    }
    Err(failed(format!(
        "The {kind} record is {} instead of {}.",
        values.join(", "),
        service.dns_expected.as_deref().unwrap_or_default()
    )))
}

fn record_value(data: &RData) -> Option<String> {
    match data {
        RData::A(address) => Some(address.to_string()),
        RData::AAAA(address) => Some(address.to_string()),
        RData::CNAME(name) => Some(name.to_string()),
        RData::MX(mx) => Some(mx.exchange().to_string()),
        RData::TXT(txt) => Some(
            txt.txt_data()
                .iter()
                .map(|part| String::from_utf8_lossy(part).into_owned())
                .collect::<String>(),
        ),
        _ => None,
    }
}

/// Names compare without case and trailing dot, as DNS does.
fn normalize(value: &str) -> String {
    value.trim().trim_end_matches('.').to_lowercase()
}

/// When the certificate of an HTTPS address runs out. Only reads it, the
/// HTTPS check itself decides whether the site is up.
pub async fn certificate_expiry(url: &str) -> anyhow::Result<DateTime<Utc>> {
    let parsed = reqwest::Url::parse(url)?;
    let host = parsed.host_str().ok_or_else(|| anyhow::anyhow!("no host"))?.to_string();
    let port = parsed.port_or_known_default().unwrap_or(443);

    let mut roots = RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let provider = Arc::new(tokio_rustls::rustls::crypto::ring::default_provider());
    let config = ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()?
        .with_root_certificates(roots)
        .with_no_client_auth();
    let connector = TlsConnector::from(Arc::new(config));
    let name = ServerName::try_from(host.trim_start_matches('[').trim_end_matches(']').to_string())?;

    let stream = tokio::time::timeout(TIMEOUT, TcpStream::connect((host.as_str(), port))).await??;
    let tls = tokio::time::timeout(TIMEOUT, connector.connect(name, stream)).await??;
    let (_, connection) = tls.get_ref();
    let certificate = connection
        .peer_certificates()
        .and_then(|chain| chain.first())
        .ok_or_else(|| anyhow::anyhow!("no certificate"))?;
    let (_, parsed) = x509_parser::parse_x509_certificate(certificate.as_ref())?;
    let seconds = parsed.validity().not_after.timestamp();
    DateTime::from_timestamp(seconds, 0).ok_or_else(|| anyhow::anyhow!("bad expiry date"))
}
