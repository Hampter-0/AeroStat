use clap::{Parser, Subcommand};
use owo_colors::OwoColorize;

pub const BANNER: &str = r#"
   ____  ____  _______   __   ______________  ________  _______    ____  _____
  / __ \/ __ \/ ____/ | / /  / ___/_  __/   |/_  __/ / / / ___/   / __ \/ ___/
 / / / / /_/ / __/ /  |/ /   \__ \ / / / /| | / / / / / /\__ \   / /_/ /\__ \ 
/ /_/ / ____/ /___/ /|  /   ___/ // / / ___ |/ / / /_/ /___/ /  / _, _/___/ /
\____/_/   /_____/_/ |_/   /____//_/ /_/  |_/_/  \____//____/  /_/ |_|/____/
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
        "Open Status Rs — self-hosted monitoring".bold(),
        format!("v{}", env!("CARGO_PKG_VERSION")).dimmed()
    );
    println!();
}