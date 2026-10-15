use clap::{Parser, Subcommand};
use owo_colors::OwoColorize;

pub const BANNER: &str = r#"
    ___                  _____ __        __ 
   /   | ___  _________ / ___// /_____ _/ /_
  / /| |/ _ \/ ___/ __ \\__ \/ __/ __  / __/
 / ___ /  __/ /  / /_/ /__/ / /_/ /_/ / /_  
/_/  |_\___/_/   \____/____/\__/\____/\__/     

"#;

#[derive(Parser)]
#[command(name = "statuspage-backend", version, about, long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Run pending database migrations
    Migrate,
    /// Seed services/groups from config/services.yml
    Seed,
}

pub fn print_banner() {
    println!("{}", BANNER.truecolor(124, 66, 38));
    println!(
        "  {} {}",
        "AeroStat — self-hosted monitoring".bold(),
        format!("v{}", env!("CARGO_PKG_VERSION")).dimmed()
    );
    println!();
}
