//! Keeps the newest log lines in memory so the panel can show them. The normal
//! output to the terminal or `docker logs` is unchanged; this is a copy.

use std::collections::VecDeque;
use std::fmt::Debug;
use std::sync::{LazyLock, Mutex};

use chrono::{DateTime, Utc};
use serde::Serialize;
use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::layer::{Context, Layer};

/// About 2000 lines of up to 2000 characters stays well under 5 MB.
pub const CAPACITY: usize = 2000;
const MAX_LINE: usize = 2000;

#[derive(Clone, Serialize)]
pub struct LogLine {
    pub id: u64,
    pub time: DateTime<Utc>,
    pub level: &'static str,
    pub target: String,
    pub message: String,
}

struct Buffer {
    next_id: u64,
    lines: VecDeque<LogLine>,
}

static BUFFER: LazyLock<Mutex<Buffer>> = LazyLock::new(|| {
    Mutex::new(Buffer {
        next_id: 1,
        lines: VecDeque::with_capacity(CAPACITY),
    })
});

/// A tracing layer that copies every event that passes the log filter.
pub struct BufferLayer;

impl<S: Subscriber> Layer<S> for BufferLayer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let mut visitor = MessageVisitor::default();
        event.record(&mut visitor);
        let mut message = visitor.message;
        if !visitor.fields.is_empty() {
            if !message.is_empty() {
                message.push(' ');
            }
            message.push_str(&visitor.fields.join(" "));
        }
        if message.chars().count() > MAX_LINE {
            message = message.chars().take(MAX_LINE).collect::<String>() + "…";
        }

        let level = match *event.metadata().level() {
            Level::ERROR => "error",
            Level::WARN => "warn",
            Level::INFO => "info",
            Level::DEBUG => "debug",
            Level::TRACE => "trace",
        };
        let Ok(mut buffer) = BUFFER.lock() else {
            return;
        };
        let id = buffer.next_id;
        buffer.next_id += 1;
        if buffer.lines.len() == CAPACITY {
            buffer.lines.pop_front();
        }
        buffer.lines.push_back(LogLine {
            id,
            time: Utc::now(),
            level,
            target: event.metadata().target().to_string(),
            message,
        });
    }
}

#[derive(Default)]
struct MessageVisitor {
    message: String,
    fields: Vec<String>,
}

impl Visit for MessageVisitor {
    fn record_str(&mut self, field: &Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        } else {
            self.fields.push(format!("{}={}", field.name(), value));
        }
    }

    fn record_debug(&mut self, field: &Field, value: &dyn Debug) {
        if field.name() == "message" {
            self.message = format!("{value:?}");
        } else {
            self.fields.push(format!("{}={:?}", field.name(), value));
        }
    }
}

/// Every line kept right now, oldest first.
pub fn lines() -> Vec<LogLine> {
    match BUFFER.lock() {
        Ok(buffer) => buffer.lines.iter().cloned().collect(),
        Err(_) => Vec::new(),
    }
}
