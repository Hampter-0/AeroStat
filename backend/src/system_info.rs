//! Facts about the machine for the System page. Read from /proc, so they are
//! only filled in on Linux (which includes every Docker install).

use std::fs;

pub struct MachineInfo {
    pub cpu: Option<String>,
    pub cpu_cores: usize,
    pub memory_total_bytes: Option<u64>,
    pub memory_used_bytes: Option<u64>,
    pub process_memory_bytes: Option<u64>,
    pub kernel: Option<String>,
    pub arch: &'static str,
    pub in_docker: bool,
}

pub fn machine() -> MachineInfo {
    let (memory_total_bytes, memory_used_bytes) = memory();
    MachineInfo {
        cpu: cpu_model(),
        cpu_cores: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        memory_total_bytes,
        memory_used_bytes,
        process_memory_bytes: process_memory(),
        kernel: fs::read_to_string("/proc/sys/kernel/osrelease")
            .ok()
            .map(|text| text.trim().to_string()),
        arch: std::env::consts::ARCH,
        in_docker: fs::metadata("/.dockerenv").is_ok(),
    }
}

fn cpu_model() -> Option<String> {
    let text = fs::read_to_string("/proc/cpuinfo").ok()?;
    text.lines()
        .find(|line| line.starts_with("model name"))
        .and_then(|line| line.split_once(':'))
        .map(|(_, value)| value.trim().to_string())
}

/// Reads a "Key:   1234 kB" value from a /proc file, in bytes.
fn kib_value(text: &str, key: &str) -> Option<u64> {
    let line = text.lines().find(|line| line.starts_with(key))?;
    let number = line.split_whitespace().nth(1)?.parse::<u64>().ok()?;
    Some(number * 1024)
}

fn memory() -> (Option<u64>, Option<u64>) {
    let Ok(text) = fs::read_to_string("/proc/meminfo") else {
        return (None, None);
    };
    let total = kib_value(&text, "MemTotal:");
    let available = kib_value(&text, "MemAvailable:");
    let used = match (total, available) {
        (Some(total), Some(available)) => Some(total.saturating_sub(available)),
        _ => None,
    };
    (total, used)
}

fn process_memory() -> Option<u64> {
    let text = fs::read_to_string("/proc/self/status").ok()?;
    kib_value(&text, "VmRSS:")
}
