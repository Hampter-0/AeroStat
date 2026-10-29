use clap::{Parser, Subcommand};
use owo_colors::OwoColorize;

pub const BANNER: &str = r#"
   █████████                                █████████   █████               █████   
  ███▒▒▒▒▒███                              ███▒▒▒▒▒███ ▒▒███               ▒▒███    
 ▒███    ▒███   ██████  ████████   ██████ ▒███    ▒▒▒  ███████    ██████   ███████  
 ▒███████████  ███▒▒███▒▒███▒▒███ ███▒▒███▒▒█████████ ▒▒▒███▒    ▒▒▒▒▒███ ▒▒▒███▒   
 ▒███▒▒▒▒▒███ ▒███████  ▒███ ▒▒▒ ▒███ ▒███ ▒▒▒▒▒▒▒▒███  ▒███      ███████   ▒███    
 ▒███    ▒███ ▒███▒▒▒   ▒███     ▒███ ▒███ ███    ▒███  ▒███ ███ ███▒▒███   ▒███ ███
 █████   █████▒▒██████  █████    ▒▒██████ ▒▒█████████   ▒▒█████ ▒▒████████  ▒▒█████ 
▒▒▒▒▒   ▒▒▒▒▒  ▒▒▒▒▒▒  ▒▒▒▒▒      ▒▒▒▒▒▒   ▒▒▒▒▒▒▒▒▒     ▒▒▒▒▒   ▒▒▒▒▒▒▒▒    ▒▒▒▒▒      

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
    println!("{}", BANNER.truecolor(255, 255, 255));
    println!(
        "  {} {}",
        "AeroStat — self-hosted monitoring".bold(),
        format!("v{}", env!("CARGO_PKG_VERSION")).dimmed()
    );
    println!();
}
