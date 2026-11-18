use std::io::{self, BufRead, Write};

use chrono::{DateTime, Utc};
use owo_colors::OwoColorize;
use deadpool_redis::Pool as RedisPool;
use sqlx::PgPool;

use serde_json::json;

use crate::backups::{self, Kind};
use crate::services::update_checker::CURRENT_VERSION;
use crate::{activity, db, login_guard, routes};

const ACCENT: (u8, u8, u8) = (0x56, 0xc7, 0xe4);

struct MenuItem {
    number: &'static str,
    name: &'static str,
    description: &'static str,
}

const MENU: [MenuItem; 16] = [
    MenuItem { number: "1", name: "help", description: "Show all commands" },
    MenuItem { number: "2", name: "migrate", description: "Run database migrations" },
    MenuItem { number: "3", name: "create-admin", description: "Create an admin account (or reset one)" },
    MenuItem { number: "4", name: "users", description: "List all accounts" },
    MenuItem { number: "5", name: "reset-password", description: "Set a new password for an account" },
    MenuItem { number: "6", name: "unblock", description: "Lift a sign-in block for an account or IP" },
    MenuItem { number: "7", name: "reset-2fa", description: "Turn off two-factor sign-in for an account" },
    MenuItem { number: "8", name: "remove-passkeys", description: "Remove every passkey of an account" },
    MenuItem { number: "9", name: "enable-password-login", description: "Let an account sign in with its password again" },
    MenuItem { number: "10", name: "set-email", description: "Change or remove the email address of an account" },
    MenuItem { number: "11", name: "backups", description: "List the backups" },
    MenuItem { number: "12", name: "backup", description: "Make a backup now" },
    MenuItem { number: "13", name: "restore", description: "Put a backup back (replaces the database)" },
    MenuItem { number: "14", name: "set-owner", description: "Make an account the owner, the others stop being owner" },
    MenuItem { number: "15", name: "unsuspend", description: "Let a suspended account sign in again" },
    MenuItem { number: "0", name: "exit", description: "Leave the CLI" },
];

enum Action {
    Help,
    Migrate,
    CreateAdmin,
    Users,
    ResetPassword,
    Unblock,
    ResetTwoFactor,
    RemovePasskeys,
    EnablePasswordLogin,
    SetEmail,
    Backups,
    Backup,
    Restore,
    SetOwner,
    Unsuspend,
    Exit,
}

fn parse_action(input: &str) -> Option<Action> {
    match input {
        "1" | "help" | "h" | "?" => Some(Action::Help),
        "2" | "migrate" => Some(Action::Migrate),
        "3" | "create-admin" => Some(Action::CreateAdmin),
        "4" | "users" => Some(Action::Users),
        "5" | "reset-password" => Some(Action::ResetPassword),
        "6" | "unblock" => Some(Action::Unblock),
        "7" | "reset-2fa" => Some(Action::ResetTwoFactor),
        "8" | "remove-passkeys" => Some(Action::RemovePasskeys),
        "9" | "enable-password-login" => Some(Action::EnablePasswordLogin),
        "10" | "set-email" => Some(Action::SetEmail),
        "11" | "backups" => Some(Action::Backups),
        "12" | "backup" => Some(Action::Backup),
        "13" | "restore" => Some(Action::Restore),
        "14" | "set-owner" => Some(Action::SetOwner),
        "15" | "unsuspend" => Some(Action::Unsuspend),
        "0" | "exit" | "quit" | "q" => Some(Action::Exit),
        _ => None,
    }
}

pub async fn run(pool: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
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
            Action::ResetPassword => reset_password(pool, redis).await,
            Action::Unblock => unblock(pool, redis).await,
            Action::ResetTwoFactor => reset_two_factor(pool).await,
            Action::RemovePasskeys => remove_passkeys(pool).await,
            Action::EnablePasswordLogin => enable_password_login(pool).await,
            Action::SetEmail => set_email(pool).await,
            Action::Backups => list_backups().await.map(|_| ()),
            Action::Backup => make_backup().await,
            Action::Restore => restore_backup().await,
            Action::SetOwner => set_owner(pool).await,
            Action::Unsuspend => unsuspend(pool).await,
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
    let width = MENU.iter().map(|item| item.name.len()).max().unwrap_or(0) + 2;
    for item in &MENU {
        // Pad before colouring, the colour codes would otherwise count as width.
        println!(
            "  {}  {} {}",
            format!("{:>2}", item.number).truecolor(ACCENT.0, ACCENT.1, ACCENT.2).bold(),
            format!("{:<width$}", item.name).bold(),
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

async fn reset_password(pool: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
    let username = ask("Username or email")?;
    let password = ask_new_password()?;
    routes::manage::reset_password_from_cli(pool, &username, password).await?;
    // A new password should work right away, even after a lockout.
    if let Err(e) = login_guard::unblock(pool, redis, &username).await {
        println!("  {} Could not lift a sign-in block: {e:#}", "!".yellow().bold());
    }
    success(&format!("Password for '{}' changed. Their sessions were signed out", username.to_lowercase()));
    Ok(())
}

async fn unblock(pool: &PgPool, redis: &RedisPool) -> anyhow::Result<()> {
    let input = ask("Username, email or IP")?;
    let removed = login_guard::unblock(pool, redis, &input).await?;
    if removed == 0 {
        success(&format!("'{}' was not blocked and has no failed sign-ins", input.to_lowercase()));
    } else {
        success(&format!("Sign-in block for '{}' lifted", input.to_lowercase()));
    }
    Ok(())
}

fn size_text(bytes: u64) -> String {
    let units = ["B", "KB", "MB", "GB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < units.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} B")
    } else {
        format!("{value:.1} {}", units[unit])
    }
}

fn kind_text(kind: Kind) -> &'static str {
    match kind {
        Kind::Manual => "manual",
        Kind::Scheduled => "scheduled",
        Kind::Update => "before update",
        Kind::Restore => "before restore",
        Kind::Upload => "uploaded",
    }
}

/// Prints the backups with a number each, newest first, and returns them.
async fn list_backups() -> anyhow::Result<Vec<backups::Backup>> {
    let list = backups::list().await?;
    if list.is_empty() {
        println!("  No backups yet. Use {} to make one.\n", "backup".bold());
        return Ok(list);
    }
    println!();
    for (index, backup) in list.iter().enumerate() {
        println!(
            "  {}  {}  {:<15} v{:<9} {:>9}  {}",
            format!("{:>2}", index + 1).truecolor(ACCENT.0, ACCENT.1, ACCENT.2).bold(),
            backup.created_at.format("%Y-%m-%d %H:%M UTC").to_string().bold(),
            kind_text(backup.kind),
            backup.version,
            size_text(backup.size_bytes),
            backup.id.dimmed()
        );
    }
    println!();
    Ok(list)
}

async fn make_backup() -> anyhow::Result<()> {
    println!("  Making a backup…");
    let backup = backups::create(Kind::Manual, Some("command line".into()), CURRENT_VERSION, None).await?;
    success(&format!("Backup {} made ({})", backup.id, size_text(backup.size_bytes)));
    Ok(())
}

async fn restore_backup() -> anyhow::Result<()> {
    let list = list_backups().await?;
    if list.is_empty() {
        return Ok(());
    }
    let answer = ask("Number of the backup to restore")?;
    let index: usize = answer.parse().map_err(|_| anyhow::anyhow!("'{answer}' is not a number from the list"))?;
    let backup = list
        .get(index.wrapping_sub(1))
        .ok_or_else(|| anyhow::anyhow!("'{answer}' is not a number from the list"))?
        .clone();

    if backups::is_newer(&backup.version, CURRENT_VERSION) {
        anyhow::bail!(
            "This backup is from v{}, newer than this AeroStat (v{CURRENT_VERSION}). Update AeroStat first, then restore it",
            backup.version
        );
    }

    if backup.kind == Kind::Upload {
        let by = backup.created_by.clone().unwrap_or_else(|| "someone".into());
        println!();
        println!(
            "  {} This backup was uploaded in the panel by {by}, it was not made on this server.",
            "!".red().bold()
        );
        println!("    A backup runs as SQL on your database. Only restore it if you trust where it came from.");
    }

    println!();
    println!(
        "  {} This replaces everything in the database with the backup from {} (v{}).",
        "!".yellow().bold(),
        backup.created_at.format("%Y-%m-%d %H:%M UTC"),
        backup.version
    );
    println!("    Everything that changed after it is gone, including users, sessions and check history.");
    println!("    A backup of the database as it is now is made first.");
    let typed = read_line("  Type restore to go on: ")?.unwrap_or_default();
    if typed.trim() != "restore" {
        println!("  Nothing changed.\n");
        return Ok(());
    }

    println!("  Backing up the current database…");
    let safety = backups::create(
        Kind::Restore,
        Some("command line".into()),
        CURRENT_VERSION,
        Some(format!("Before restoring {}", backup.id)),
    )
    .await
    .map_err(|e| anyhow::anyhow!("Could not back up the current database, so nothing was restored: {e:#}"))?;
    println!("  Saved as {}", safety.id.dimmed());

    println!("  Restoring…");
    backups::restore(&backup.id).await?;
    success(&format!(
        "Restored {}. Restart AeroStat so it picks this up and runs any newer migrations: docker compose restart backend",
        backup.id
    ));
    Ok(())
}

/// Finds an account by username or email.
async fn find_user(pool: &PgPool, input: &str) -> anyhow::Result<(i64, String)> {
    let input = input.trim().to_lowercase();
    let user: Option<(i64, String)> =
        sqlx::query_as("SELECT id, username FROM users WHERE username = $1 OR lower(email) = $1")
            .bind(&input)
            .fetch_optional(pool)
            .await?;
    user.ok_or_else(|| anyhow::anyhow!("No account with username or email '{input}'"))
}

/// Asks yes or no. Anything but y or yes counts as no.
fn confirm(question: &str) -> anyhow::Result<bool> {
    let answer = read_line(&format!("  {question} [y/N]: "))?.unwrap_or_default();
    Ok(matches!(answer.trim().to_lowercase().as_str(), "y" | "yes"))
}

/// Writes a line to the activity log so admins see what was changed on the server.
async fn log_cli(pool: &PgPool, id: i64, username: &str, action: &str) {
    activity::record_account(pool, Some(id), username, action, "command line", Some(json!({ "via": "command line" }))).await;
}

async fn reset_two_factor(pool: &PgPool) -> anyhow::Result<()> {
    let (id, username) = find_user(pool, &ask("Username or email")?).await?;
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE users SET totp_secret = NULL, totp_last_step = NULL, email_two_factor = false WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM recovery_codes WHERE user_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    log_cli(pool, id, &username, "two-factor sign-in was reset").await;
    success(&format!("Two-factor sign-in for '{username}' is off. They sign in with just their password now"));
    Ok(())
}

async fn remove_passkeys(pool: &PgPool) -> anyhow::Result<()> {
    let (id, username) = find_user(pool, &ask("Username or email")?).await?;
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM passkeys WHERE user_id = $1")
        .bind(id)
        .fetch_one(pool)
        .await?;
    if count == 0 {
        success(&format!("'{username}' has no passkeys"));
        return Ok(());
    }
    if !confirm(&format!("Remove {count} passkey(s) of '{username}'?"))? {
        println!("  Nothing changed.\n");
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM passkeys WHERE user_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    // Without passkeys the password is the only way in.
    sqlx::query("UPDATE users SET password_login = true WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    log_cli(pool, id, &username, "passkeys were removed").await;
    success(&format!("Removed {count} passkey(s) of '{username}'. Password sign-in is on"));
    Ok(())
}

async fn enable_password_login(pool: &PgPool) -> anyhow::Result<()> {
    let (id, username) = find_user(pool, &ask("Username or email")?).await?;
    let result = sqlx::query("UPDATE users SET password_login = true WHERE id = $1 AND NOT password_login")
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        success(&format!("'{username}' can already sign in with their password"));
        return Ok(());
    }
    log_cli(pool, id, &username, "password sign-in was turned on").await;
    success(&format!("'{username}' can sign in with their password again. Use reset-password if they forgot it"));
    Ok(())
}

async fn unsuspend(pool: &PgPool) -> anyhow::Result<()> {
    let (id, username) = find_user(pool, &ask("Username or email")?).await?;
    let result = sqlx::query("UPDATE users SET suspended = false WHERE id = $1 AND suspended")
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        success(&format!("'{username}' isn't suspended"));
        return Ok(());
    }
    log_cli(pool, id, &username, "was unsuspended").await;
    success(&format!("'{username}' can sign in again"));
    Ok(())
}

/// Hands the owner role to another account. Only possible with server access,
/// since the owner is the one account nobody else in the panel can change.
async fn set_owner(pool: &PgPool) -> anyhow::Result<()> {
    let (id, username) = find_user(pool, &ask("Username or email of the new owner")?).await?;
    let is_super: bool = sqlx::query_scalar("SELECT user_is_super($1)").bind(id).fetch_one(pool).await?;
    if !is_super {
        anyhow::bail!("'{username}' is not an admin. Make them one in the panel first");
    }
    if !confirm(&format!("Make '{username}' the owner? Every other owner becomes a normal admin"))? {
        success("Nothing changed");
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE users SET owner = (id = $1) WHERE owner OR id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    log_cli(pool, id, &username, "was made the owner").await;
    success(&format!("'{username}' is the owner now"));
    Ok(())
}

async fn set_email(pool: &PgPool) -> anyhow::Result<()> {
    let (id, username) = find_user(pool, &ask("Username or email")?).await?;
    let answer = read_line("  New email (empty removes it): ")?.unwrap_or_default();
    let trimmed = answer.trim().to_string();
    let email = if trimmed.is_empty() { None } else { Some(trimmed) };
    if let Some(address) = &email {
        let valid = address.len() <= 254
            && !address.contains(char::is_whitespace)
            && address
                .split_once('@')
                .is_some_and(|(local, domain)| !local.is_empty() && domain.contains('.'));
        if !valid {
            anyhow::bail!("'{address}' is not a valid email address");
        }
        let taken: Option<(String,)> =
            sqlx::query_as("SELECT username FROM users WHERE lower(email) = lower($1) AND id <> $2")
                .bind(address)
                .bind(id)
                .fetch_optional(pool)
                .await?;
        if let Some((other,)) = taken {
            anyhow::bail!("'{address}' is already used by '{other}'");
        }
    }
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE users SET email = $1 WHERE id = $2")
        .bind(&email)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    // A reset link sent to the old address must stop working.
    sqlx::query("DELETE FROM password_resets WHERE user_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if email.is_none() {
        // Email codes can't arrive without an address.
        sqlx::query("UPDATE users SET email_two_factor = false WHERE id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    match &email {
        Some(address) => {
            log_cli(pool, id, &username, "email address was changed").await;
            success(&format!("Email of '{username}' is now {address}"));
        }
        None => {
            log_cli(pool, id, &username, "email address was removed").await;
            success(&format!("Email of '{username}' removed"));
        }
    }
    Ok(())
}

#[derive(sqlx::FromRow)]
struct UserListRow {
    username: String,
    email: Option<String>,
    roles: Vec<String>,
    created_at: DateTime<Utc>,
}

async fn list_users(pool: &PgPool) -> anyhow::Result<()> {
    let users: Vec<UserListRow> = sqlx::query_as(
        "SELECT u.username, u.email, \
         (CASE WHEN u.super_user THEN ARRAY['Admin'] ELSE ARRAY[]::text[] END || ARRAY(SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id ORDER BY r.name) \
          || CASE WHEN u.suspended THEN ARRAY['suspended'] ELSE ARRAY[]::text[] END) AS roles, \
         u.created_at FROM users u ORDER BY u.username",
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
            let access = if user.roles.is_empty() {
                "no roles".to_string()
            } else {
                user.roles.join(", ")
            };
            let email = user.email.clone().unwrap_or_else(|| "-".to_string());
            (user.username.as_str(), email, access, user.created_at.format("%Y-%m-%d").to_string())
        })
        .collect();

    let name_width = rows.iter().map(|row| row.0.len()).max().unwrap_or(0).max("USERNAME".len()) + 3;
    let email_width = rows.iter().map(|row| row.1.len()).max().unwrap_or(0).max("EMAIL".len()) + 3;
    let access_width = rows.iter().map(|row| row.2.len()).max().unwrap_or(0).max("ROLES".len()) + 3;

    println!();
    println!(
        "  {}{}{}{}",
        pad("USERNAME", name_width).dimmed(),
        pad("EMAIL", email_width).dimmed(),
        pad("ROLES", access_width).dimmed(),
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
