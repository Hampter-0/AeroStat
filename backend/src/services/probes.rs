//! Checks that speak a little of a real protocol: ping, databases and game
//! servers. Each one returns the reason in words when the service is down.
//! None of them need a password: an answer that says "log in first" still
//! proves the server is up.

use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpStream, UdpSocket};
use tokio::time::timeout;

const TIMEOUT: Duration = Duration::from_secs(10);
const TIMEOUT_TEXT: &str = "It did not answer within 10 seconds.";

/// Default port per check type, used when only a host is given.
pub fn default_port(check_type: &str) -> Option<u16> {
    match check_type {
        "postgres" => Some(5432),
        "mysql" => Some(3306),
        "redis" => Some(6379),
        "minecraft" => Some(25565),
        "bedrock" => Some(19132),
        "source" => Some(27015),
        _ => None,
    }
}

pub async fn run(check_type: &str, target: &str) -> Result<(), String> {
    match timeout(TIMEOUT, probe(check_type, target)).await {
        Ok(result) => result,
        Err(_) => Err(TIMEOUT_TEXT.to_string()),
    }
}

async fn probe(check_type: &str, target: &str) -> Result<(), String> {
    match check_type {
        "ping" => ping(target).await,
        "postgres" => postgres(target).await,
        "mysql" => mysql(target).await,
        "redis" => redis(target).await,
        "minecraft" => minecraft(target).await,
        "bedrock" => bedrock(target).await,
        "source" => source(target).await,
        _ => Err(format!("Unknown check type {check_type}.")),
    }
}

async fn resolve(target: &str) -> Result<SocketAddr, String> {
    let mut addresses = tokio::net::lookup_host(target)
        .await
        .map_err(|_| "The host name could not be found.".to_string())?;
    addresses.next().ok_or_else(|| "The host name could not be found.".to_string())
}

async fn connect(target: &str) -> Result<TcpStream, String> {
    match TcpStream::connect(target).await {
        Ok(stream) => Ok(stream),
        Err(e) if e.kind() == std::io::ErrorKind::ConnectionRefused => Err("The connection was refused.".to_string()),
        Err(e) => Err(format!("The connection failed: {e}.")),
    }
}

/// Up when the host answers an ICMP echo. Uses an unprivileged ICMP socket,
/// which Docker allows by default.
async fn ping(host: &str) -> Result<(), String> {
    let ip: IpAddr = match host.trim_matches(['[', ']']).parse() {
        Ok(ip) => ip,
        Err(_) => resolve(&format!("{host}:0")).await?.ip(),
    };
    let config = match ip {
        IpAddr::V4(_) => surge_ping::Config::default(),
        IpAddr::V6(_) => surge_ping::Config::builder().kind(surge_ping::ICMP::V6).build(),
    };
    let client = surge_ping::Client::new(&config).map_err(|e| {
        tracing::warn!("Could not open an ICMP socket: {e}");
        "This server is not allowed to send pings. See Troubleshooting in the docs.".to_string()
    })?;
    let mut pinger = client.pinger(ip, surge_ping::PingIdentifier(rand::random())).await;
    pinger.timeout(TIMEOUT);
    match pinger.ping(surge_ping::PingSequence(0), &[0; 16]).await {
        Ok(_) => Ok(()),
        Err(surge_ping::SurgeError::Timeout { .. }) => Err("It did not answer the ping within 10 seconds.".to_string()),
        Err(e) => Err(format!("The ping failed: {e}.")),
    }
}

/// Up when the server answers PostgreSQL's SSL request with yes or no.
async fn postgres(target: &str) -> Result<(), String> {
    let mut stream = connect(target).await?;
    stream
        .write_all(&[0, 0, 0, 8, 0x04, 0xd2, 0x16, 0x2f])
        .await
        .map_err(|e| format!("The connection failed: {e}."))?;
    let mut answer = [0u8; 1];
    stream
        .read_exact(&mut answer)
        .await
        .map_err(|_| "It closed the connection without answering like PostgreSQL.".to_string())?;
    if answer[0] == b'S' || answer[0] == b'N' {
        Ok(())
    } else {
        Err("It did not answer like a PostgreSQL server.".to_string())
    }
}

/// Up when the server greets with a MySQL or MariaDB handshake, or with an
/// error packet such as "host is not allowed", which still means it runs.
async fn mysql(target: &str) -> Result<(), String> {
    let mut stream = connect(target).await?;
    let mut header = [0u8; 5];
    stream
        .read_exact(&mut header)
        .await
        .map_err(|_| "It closed the connection without a MySQL greeting.".to_string())?;
    if header[4] == 0x0a || header[4] == 0xff {
        Ok(())
    } else {
        Err("It did not greet like a MySQL or MariaDB server.".to_string())
    }
}

/// Up when the server answers PING, also with "log in first".
async fn redis(target: &str) -> Result<(), String> {
    let mut stream = connect(target).await?;
    stream.write_all(b"PING\r\n").await.map_err(|e| format!("The connection failed: {e}."))?;
    let mut answer = [0u8; 1];
    stream
        .read_exact(&mut answer)
        .await
        .map_err(|_| "It closed the connection without answering like Redis.".to_string())?;
    if answer[0] == b'+' || answer[0] == b'-' {
        Ok(())
    } else {
        Err("It did not answer like a Redis server.".to_string())
    }
}

fn varint(mut value: u32, out: &mut Vec<u8>) {
    loop {
        if value & !0x7f == 0 {
            out.push(value as u8);
            return;
        }
        out.push((value as u8 & 0x7f) | 0x80);
        value >>= 7;
    }
}

async fn read_varint(stream: &mut TcpStream) -> Result<u32, String> {
    let mut value = 0u32;
    for position in 0..5 {
        let byte = stream.read_u8().await.map_err(|_| "It closed the connection.".to_string())?;
        value |= ((byte & 0x7f) as u32) << (7 * position);
        if byte & 0x80 == 0 {
            return Ok(value);
        }
    }
    Err("It sent an answer that is not a Minecraft status.".to_string())
}

/// Up when a Minecraft Java server answers the server list ping.
async fn minecraft(target: &str) -> Result<(), String> {
    let (host, port) = target.rsplit_once(':').unwrap_or((target, "25565"));
    let port: u16 = port.parse().unwrap_or(25565);
    let mut stream = connect(target).await?;

    let mut handshake = Vec::new();
    varint(0, &mut handshake);
    varint(767, &mut handshake);
    let host = host.trim_matches(['[', ']']);
    varint(host.len() as u32, &mut handshake);
    handshake.extend_from_slice(host.as_bytes());
    handshake.extend_from_slice(&port.to_be_bytes());
    varint(1, &mut handshake);

    let mut packet = Vec::new();
    varint(handshake.len() as u32, &mut packet);
    packet.extend_from_slice(&handshake);
    packet.extend_from_slice(&[1, 0]);
    stream.write_all(&packet).await.map_err(|e| format!("The connection failed: {e}."))?;

    let _length = read_varint(&mut stream).await?;
    let id = read_varint(&mut stream).await?;
    let size = read_varint(&mut stream).await? as usize;
    if id != 0 || size == 0 || size > 1024 * 1024 {
        return Err("It sent an answer that is not a Minecraft status.".to_string());
    }
    let mut json = vec![0u8; size];
    stream
        .read_exact(&mut json)
        .await
        .map_err(|_| "It closed the connection before the status was complete.".to_string())?;
    let status: serde_json::Value =
        serde_json::from_slice(&json).map_err(|_| "It sent a Minecraft status that could not be read.".to_string())?;
    if status.get("version").is_some() || status.get("players").is_some() {
        Ok(())
    } else {
        Err("It sent a Minecraft status without a version.".to_string())
    }
}

async fn udp_exchange(target: &str, request: &[u8]) -> Result<Vec<u8>, String> {
    let address = resolve(target).await?;
    let bind: SocketAddr = if address.is_ipv4() { "0.0.0.0:0".parse().unwrap() } else { "[::]:0".parse().unwrap() };
    let socket = UdpSocket::bind(bind).await.map_err(|e| format!("Could not open a UDP socket: {e}."))?;
    socket.connect(address).await.map_err(|e| format!("The connection failed: {e}."))?;
    socket.send(request).await.map_err(|e| format!("Sending failed: {e}."))?;
    let mut buffer = vec![0u8; 2048];
    let size = socket.recv(&mut buffer).await.map_err(|e| match e.kind() {
        std::io::ErrorKind::ConnectionRefused | std::io::ErrorKind::ConnectionReset => {
            "Nothing answered on this port.".to_string()
        }
        _ => format!("It did not answer: {e}."),
    })?;
    buffer.truncate(size);
    Ok(buffer)
}

const RAKNET_MAGIC: [u8; 16] = [0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78];

/// Up when a Minecraft Bedrock server answers an unconnected ping.
async fn bedrock(target: &str) -> Result<(), String> {
    let mut request = vec![0x01];
    request.extend_from_slice(&(chrono::Utc::now().timestamp_millis()).to_be_bytes());
    request.extend_from_slice(&RAKNET_MAGIC);
    request.extend_from_slice(&rand::random::<u64>().to_be_bytes());
    let answer = udp_exchange(target, &request).await?;
    if answer.first() == Some(&0x1c) {
        Ok(())
    } else {
        Err("It did not answer like a Minecraft Bedrock server.".to_string())
    }
}

/// Up when a Source engine server (CS2, Rust, Garry's Mod and many more)
/// answers A2S_INFO, after the challenge newer servers ask for.
async fn source(target: &str) -> Result<(), String> {
    let mut query = vec![0xff, 0xff, 0xff, 0xff, 0x54];
    query.extend_from_slice(b"Source Engine Query\0");
    let mut answer = udp_exchange(target, &query).await?;
    if answer.len() >= 9 && answer[..4] == [0xff; 4] && answer[4] == 0x41 {
        let mut again = query.clone();
        again.extend_from_slice(&answer[5..9]);
        answer = udp_exchange(target, &again).await?;
    }
    let single = answer.len() >= 5 && answer[..4] == [0xff; 4] && answer[4] == 0x49;
    let split = answer.len() >= 4 && answer[..4] == [0xfe, 0xff, 0xff, 0xff];
    if single || split {
        Ok(())
    } else {
        Err("It did not answer like a Source game server.".to_string())
    }
}
