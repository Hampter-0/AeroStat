use std::io::{self, BufRead, Write};

use chrono::{DateTime, Utc};
use owo_colors::OwoColorize;
use sqlx::PgPool;

use crate::{db, routes};

const ACCENT: (u8, u8, u8) = (0x56, 0xc7, 0xe4);

struct MenuItem {
    number: &'static str,
    name: &'static str,
    description: &'static str,
}

const MENU: [MenuItem; 6] = [
    MenuItem { number: "1", name: "help", description: "Show all commands" },
    MenuItem { number: "2", name: "migrate", description: "Run database migrations" },
    MenuItem { number: "3", name: "create-admin", description: "Create an admin account (or reset one)" },
    MenuItem { number: "4", name: "users", description: "List all accounts" },
    MenuItem { number: "5", name: "reset-password", description: "Set a new password for an account" },
    MenuItem { number: "0", name: "exit", description: "Leave the CLI" },
];

enum Action {
    Help,
    Migrate,
    CreateAdmin,
    Users,
    ResetPassword,
    Exit,
}

fn parse_action(input: &str) -> Option<Action> {
    match input {
        "1" | "help" | "h" | "?" => Some(Action::Help),
        "2" | "migrate" => Some(Action::Migrate),
        "3" | "create-admin" => Some(Action::CreateAdmin),
        "4" | "users" => Some(Action::Users),
        "5" | "reset-password" => Some(Action::ResetPassword),
        "0" | "exit" | "quit" | "q" => Some(Action::Exit),
        _ => None,
    }
}

pub async fn run(pool: &PgPool) -> anyhow::Result<()> {
    db::migrate(pool).await?;

    println!(
        "  {} — type a number or command, or {} for the list.",
        "AeroStat CLI".bold(),
        "help".truecolor(ACCENT.0, ACCENT.1, ACCENT.2)
    );
    print_menu();

    loop {
        let line = match read_line(&format!("{} ", "aerostat>".truecolor(ACCENT.0, ACCENT.1, ACCENT.2).bold()))? {
            Some(line) => line,
            None => break,
        };
        let input = line.trim().to_lowercase();
        if input.is_empty() {
            continue;
        }

        let Some(action) = parse_action(&input) else {
            println!("  Unknown command '{input}'. Type {} for the list.\n", "help".bold());
            continue;
        };

        let result = match action {
            Action::Help => {
                print_menu();
                Ok(())
            }
            Action::Migrate => migrate(pool).await,
            Action::CreateAdmin => create_admin(pool).await,
            Action::Users => list_users(pool).await,
            Action::ResetPassword => reset_password(pool).await,
            Action::Exit => break,
        };

        if let Err(error) = result {
            println!("  {} {error:#}\n", "✗".red().bold());
        }
    }

    println!("  Bye!");
    Ok(())
}

fn print_menu() {
    println!();
    for item in &MENU {
        println!(
            "  {}  {:<16} {}",
            item.number.truecolor(ACCENT.0, ACCENT.1, ACCENT.2).bold(),
            item.name.bold(),
            item.description.dimmed()
        );
    }
    println!();
}

/// Prints a prompt and reads one line. Returns None on end of input (Ctrl+D / Ctrl+Z).
fn read_line(prompt: &str) -> anyhow::Result<Option<String>> {
    print!("{prompt}");
    io::stdout().flush()?;
    let mut line = String::new();
    if io::stdin().lock().read_line(&mut line)? == 0 {
        println!();
        return Ok(None);
    }
    Ok(Some(line))
}

fn ask(prompt: &str) -> anyhow::Result<String> {
    let answer = read_line(&format!("  {prompt}: "))?.unwrap_or_default();
    let answer = answer.trim().to_string();
    if answer.is_empty() {
        anyhow::bail!("Cancelled: nothing entered");
    }
    Ok(answer)
}

fn ask_new_password() -> anyhow::Result<String> {
    let password = rpassword::prompt_password("  Password: ")?;
    let confirm = rpassword::prompt_password("  Repeat password: ")?;
    if password != confirm {
        anyhow::bail!("Passwords do not match");
    }
    Ok(password)
}

fn success(message: &str) {
    println!("  {} {message}\n", "✓".green().bold());
}

async fn migrate(pool: &PgPool) -> anyhow::Result<()> {
    db::migrate(pool).await?;
    success("Database is up to date");
    Ok(())
}

async fn create_admin(pool: &PgPool) -> anyhow::Result<()> {
    let username = ask("Username")?;
    let password = ask_new_password()?;
    routes::manage::create_admin_from_cli(pool, &username, password).await?;
    success(&format!("Admin '{}' is ready. Sign in at /manage", username.to_lowercase()));
    Ok(())
}

async fn reset_password(pool: &PgPool) -> anyhow::Result<()> {
    let username = ask("Username or email")?;
    let password = ask_new_password()?;
    routes::manage::reset_password_from_cli(pool, &username, password).await?;
    success(&format!("Password for '{}' changed. Their sessions were signed out", username.to_lowercase()));
    Ok(())
}

#[derive(sqlx::FromRow)]
struct UserListRow {
    username: String,
    email: Option<String>,
    is_admin: bool,
    permissions: Vec<String>,
    created_at: DateTime<Utc>,
}

async fn list_users(pool: &PgPool) -> anyhow::Result<()> {
    let users: Vec<UserListRow> = sqlx::query_as(
        "SELECT username, email, is_admin, permissions, created_at FROM users ORDER BY username",
    )
    .fetch_all(pool)
    .await?;

    if users.is_empty() {
        println!("  No accounts yet. Use {} to make the first one.\n", "create-admin".bold());
        return Ok(());
    }

    let rows: Vec<(&str, String, String, String)> = users
        .iter()
        .map(|user| {
            let access = if user.is_admin {
                "admin".to_string()
            } else if user.permissions.is_empty() {
                "no access".to_string()
            } else {
                user.permissions.join(", ")
            };
            let email = user.email.clone().unwrap_or_else(|| "-".to_string());
            (user.username.as_str(), email, access, user.created_at.format("%Y-%m-%d").to_string())
        })
        .collect();

    let name_width = rows.iter().map(|row| row.0.len()).max().unwrap_or(0).max("USERNAME".len()) + 3;
    let email_width = rows.iter().map(|row| row.1.len()).max().unwrap_or(0).max("EMAIL".len()) + 3;
    let access_width = rows.iter().map(|row| row.2.len()).max().unwrap_or(0).max("ACCESS".len()) + 3;

    println!();
    println!(
        "  {}{}{}{}",
        pad("USERNAME", name_width).dimmed(),
        pad("EMAIL", email_width).dimmed(),
        pad("ACCESS", access_width).dimmed(),
        "CREATED".dimmed()
    );
    for (username, email, access, created) in &rows {
        println!(
            "  {}{}{}{}",
            pad(username, name_width).bold(),
            pad(email, email_width),
            pad(access, access_width),
            created.dimmed()
        );
    }
    println!();
    Ok(())
}

/// Pads before styling, because colour codes would throw off format width.
fn pad(text: &str, width: usize) -> String {
    format!("{text:<width$}")
}
