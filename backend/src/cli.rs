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
    /// Open the interactive CLI menu (does not start the server)
    Cli,
    /// Run pending database migrations
    Migrate,
    /// Create an admin account for the /manage panel (or reset an existing one's password)
    CreateAdmin {
        #[arg(long)]
        username: String,
    },
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
