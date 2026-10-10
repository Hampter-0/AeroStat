use clap::{Parser, Subcommand};

#[derive(Parser)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Run pending database migrations
    Migrate,
    /// Seed services/groups from config/services.ym
    Seed,
}
