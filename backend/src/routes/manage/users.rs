use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, Postgres, Transaction};

use crate::activity;
use crate::security_mail::{self, Change};
use crate::auth::{self, CurrentUser, PermissionGroup, PERMISSION_GROUPS};
use crate::error::ApiError;
use crate::state::AppState;

use super::roles::{self, RoleSummary};

const MIN_PASSWORD_LENGTH: usize = 8;

#[derive(Serialize, sqlx::FromRow)]
pub struct UserRow {
    id: i64,
    username: String,
    email: Option<String>,
    is_admin: bool,
    role_ids: Vec<i64>,
    /// Admin: full access to everything, whatever the roles say.
    super_user: bool,
    /// Can't sign in and gets no notifications.
    suspended: bool,
    /// Given to this user directly, on top of their roles.
    permissions: Vec<String>,
    /// The authenticator app or email codes are on.
    two_factor: bool,
    two_factor_required: bool,
    passkeys: i64,
    password_login: bool,
    /// Made with create-admin on the command line.
    owner: bool,
    created_at: DateTime<Utc>,
    last_login_at: Option<DateTime<Utc>>,
    avatar_version: Option<i64>,
}

const USER_COLUMNS: &str = "u.id, u.username, u.email, user_is_super(u.id) AS is_admin, \
     ARRAY(SELECT role_id FROM user_roles WHERE user_id = u.id ORDER BY role_id) AS role_ids, \
     u.super_user, u.permissions, (u.totp_secret IS NOT NULL OR u.email_two_factor) AS two_factor, \
     u.two_factor_required, (SELECT COUNT(*) FROM passkeys p WHERE p.user_id = u.id) AS passkeys, \
     u.password_login, u.owner, u.suspended, \
     u.created_at, u.last_login_at, \
     EXTRACT(EPOCH FROM u.avatar_updated_at)::bigint AS avatar_version";

#[derive(Serialize)]
pub struct UsersResponse {
    users: Vec<UserRow>,
    roles: Vec<RoleSummary>,
    permission_groups: &'static [PermissionGroup],
}

#[derive(Deserialize)]
pub struct CreateUser {
    username: String,
    password: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    role_ids: Vec<i64>,
    #[serde(default)]
    super_user: bool,
    #[serde(default)]
    permissions: Vec<String>,
    #[serde(default)]
    two_factor_required: bool,
}

#[derive(Deserialize)]
pub struct UpdateUser {
    role_ids: Option<Vec<i64>>,
    super_user: Option<bool>,
    permissions: Option<Vec<String>>,
    two_factor_required: Option<bool>,
    suspended: Option<bool>,
    password: Option<String>,
    /// Missing keeps the address, an empty string removes it.
    email: Option<String>,
}

/// Checks and completes permissions given straight to a user; nobody can hand
/// out what they don't have themselves.
fn direct_permissions(actor: &CurrentUser, permissions: &[String]) -> Result<Vec<String>, ApiError> {
    let permissions = auth::normalize_permissions(permissions)?;
    if !actor.covers(false, &permissions) {
        return Err(ApiError::BadRequest("You can't give permissions you don't have yourself".into()));
    }
    Ok(permissions)
}

fn require_super_to_change(actor: &CurrentUser) -> Result<(), ApiError> {
    if !actor.is_admin {
        return Err(ApiError::BadRequest("Only an admin can make someone an admin".into()));
    }
    Ok(())
}

fn email_taken() -> ApiError {
    ApiError::Conflict("That email address is already used by another account".into())
}

pub(super) fn validate_username(username: &str) -> Result<(), ApiError> {
    let valid_chars = username
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '_' || c == '-');
    if username.len() < 2 || username.len() > 32 || !valid_chars {
        return Err(ApiError::BadRequest(
            "Username must be 2-32 characters: lowercase letters, digits, '.', '_' or '-'".into(),
        ));
    }
    Ok(())
}

pub(super) fn validate_password(password: &str) -> Result<(), ApiError> {
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )));
    }
    Ok(())
}

async fn find_user(db: &PgPool, id: i64) -> Result<UserRow, ApiError> {
    let query = format!("SELECT {USER_COLUMNS} FROM users u WHERE u.id = $1");
    let user: Option<UserRow> = sqlx::query_as(&query).bind(id).fetch_optional(db).await?;
    user.ok_or(ApiError::NotFound)
}

async fn role_names(db: &PgPool, user_id: i64) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.name",
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Someone who isn't an admin can only manage users that have no more
/// rights than they have themselves.
async fn require_reach(db: &PgPool, actor: &CurrentUser, target_id: i64) -> Result<(), ApiError> {
    let (is_super, permissions): (bool, Vec<String>) =
        sqlx::query_as("SELECT user_is_super($1), user_permissions($1)")
            .bind(target_id)
            .fetch_one(db)
            .await?;
    if !actor.covers(is_super, &permissions) {
        return Err(ApiError::BadRequest(
            "This user has rights you don't have, so you can't change their account".into(),
        ));
    }
    Ok(())
}

/// Owner, then admins, then everyone else. Nobody but the owner can change
/// the owner's account, and only the owner can change, suspend or delete
/// another admin, so one admin account can't take over the others.
fn require_rank(actor: &CurrentUser, target: &UserRow) -> Result<(), ApiError> {
    if target.id == actor.id {
        return Ok(());
    }
    if target.owner {
        return Err(ApiError::BadRequest(
            "This is the owner's account. Only the owner can change it, on their own profile.".into(),
        ));
    }
    if target.is_admin && !actor.owner {
        return Err(ApiError::BadRequest("Only the owner can change or delete another admin".into()));
    }
    Ok(())
}

/// Everyone who is an admin right now.
pub(super) async fn super_user_ids(tx: &mut Transaction<'_, Postgres>) -> Result<Vec<i64>, ApiError> {
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM users WHERE user_is_super(id)")
        .fetch_all(&mut **tx)
        .await?;
    Ok(ids)
}

/// After a change: the owner stays an admin, and only the owner can take admin
/// away from someone else.
pub(super) async fn ensure_supers_kept(
    tx: &mut Transaction<'_, Postgres>,
    actor: &CurrentUser,
    before: &[i64],
) -> Result<(), ApiError> {
    let owner_lost: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE owner AND NOT user_is_super(id))")
        .fetch_one(&mut **tx)
        .await?;
    if owner_lost {
        return Err(ApiError::BadRequest("The owner always stays an admin".into()));
    }
    if actor.owner {
        return Ok(());
    }
    let after = super_user_ids(tx).await?;
    let lost = before.iter().any(|id| *id != actor.id && !after.contains(id));
    if lost {
        return Err(ApiError::BadRequest(
            "This would take admin away from someone else. Only the owner can do that.".into(),
        ));
    }
    Ok(())
}

/// Checks the roles exist and that the actor may hand them out.
async fn assignable_roles(db: &PgPool, actor: &CurrentUser, ids: &[i64]) -> Result<Vec<i64>, ApiError> {
    let mut unique: Vec<i64> = ids.to_vec();
    unique.sort();
    unique.dedup();
    let found = roles::summaries(db, &unique).await?;
    if found.len() != unique.len() {
        return Err(ApiError::BadRequest("One or more roles don't exist".into()));
    }
    for role in &found {
        if !actor.covers(false, &role.permissions) {
            return Err(ApiError::BadRequest(format!(
                "You can't give the role '{}', it has rights you don't have",
                role.name
            )));
        }
    }
    Ok(unique)
}

async fn set_roles(tx: &mut Transaction<'_, Postgres>, user_id: i64, role_ids: &[i64]) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM user_roles WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query("INSERT INTO user_roles (user_id, role_id) SELECT $1, unnest($2::bigint[])")
        .bind(user_id)
        .bind(role_ids)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Run inside the transaction of any change to users or roles, before commit.
pub(super) async fn ensure_super_user_left(tx: &mut Transaction<'_, Postgres>, actor: &CurrentUser) -> Result<(), ApiError> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE user_is_super(id)")
        .fetch_one(&mut **tx)
        .await?;
    if count == 0 {
        return Err(ApiError::BadRequest("There must always be at least one admin".into()));
    }
    if actor.is_admin {
        let (still_super,): (bool,) = sqlx::query_as("SELECT user_is_super($1)")
            .bind(actor.id)
            .fetch_one(&mut **tx)
            .await?;
        if !still_super {
            return Err(ApiError::BadRequest("You can't take away your own admin rights".into()));
        }
    }
    Ok(())
}

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> Result<Json<UsersResponse>, ApiError> {
    user.require("users.view")?;

    let query = format!("SELECT {USER_COLUMNS} FROM users u ORDER BY u.username");
    let users: Vec<UserRow> = sqlx::query_as(&query).fetch_all(&state.db).await?;
    let roles = roles::all_summaries(&state.db).await?;

    Ok(Json(UsersResponse {
        users,
        roles,
        permission_groups: PERMISSION_GROUPS,
    }))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<CreateUser>,
) -> Result<(StatusCode, Json<UserRow>), ApiError> {
    user.require("users.create")?;

    let username = body.username.trim().to_lowercase();
    validate_username(&username)?;
    validate_password(&body.password)?;
    let email = super::profile::clean_email(body.email)?;
    let role_ids = assignable_roles(&state.db, &user, &body.role_ids).await?;
    let permissions = direct_permissions(&user, &body.permissions)?;
    if body.super_user {
        require_super_to_change(&user)?;
    }

    let password_hash = auth::hash_password(body.password).await?;

    let mut tx = state.db.begin().await?;
    let created: Result<(i64,), sqlx::Error> = sqlx::query_as(
        r#"
        INSERT INTO users (username, password_hash, email, permissions, super_user, two_factor_required)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(&username)
    .bind(&password_hash)
    .bind(&email)
    .bind(&permissions)
    .bind(body.super_user)
    .bind(body.two_factor_required)
    .fetch_one(&mut *tx)
    .await;
    let id = match created {
        Ok((id,)) => id,
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            if e.constraint().unwrap_or("").contains("email") {
                return Err(email_taken());
            }
            return Err(ApiError::Conflict(format!("Username '{username}' is already taken")));
        }
        Err(e) => return Err(e.into()),
    };
    set_roles(&mut tx, id, &role_ids).await?;
    tx.commit().await?;

    let details = json!({
        "email": email,
        "roles": role_names(&state.db, id).await,
        "super_user": body.super_user,
        "permissions": permissions,
        "two_factor_required": body.two_factor_required,
    });
    activity::record(&state.db, &user, "users", "created user", None, &username, Some(details)).await;
    admin_notice(&state.db, &user, "admin_users", format!("{} added the user {username}", user.username), "/manage/users");
    Ok((StatusCode::CREATED, Json(find_user(&state.db, id).await?)))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<UpdateUser>,
) -> Result<Json<UserRow>, ApiError> {
    user.require("users.edit")?;
    let target = find_user(&state.db, id).await?;
    require_rank(&user, &target)?;
    require_reach(&state.db, &user, id).await?;

    let roles_before = role_names(&state.db, id).await;
    let mut details = json!({});

    let role_ids = match &body.role_ids {
        Some(ids) => Some(assignable_roles(&state.db, &user, ids).await?),
        None => None,
    };
    let permissions = match &body.permissions {
        Some(list) => Some(direct_permissions(&user, list)?),
        None => None,
    };
    let super_change = body.super_user.filter(|value| *value != target.super_user);
    if super_change.is_some() {
        require_super_to_change(&user)?;
    }
    let suspend_change = body.suspended.filter(|value| *value != target.suspended);
    if suspend_change.is_some() && id == user.id {
        return Err(ApiError::BadRequest("You can't suspend your own account".into()));
    }
    let email = match body.email {
        Some(text) => Some(super::profile::clean_email(Some(text))?),
        None => None,
    };
    if id == user.id {
        let email_changes = email.as_ref().is_some_and(|value| *value != target.email);
        let rule_changes = body.two_factor_required.is_some_and(|value| value != target.two_factor_required);
        if body.password.is_some() || email_changes || rule_changes {
            return Err(ApiError::BadRequest(
                "Change your own password, email and two-factor rule on your profile".into(),
            ));
        }
    }
    let password_hash = match body.password {
        Some(password) => {
            validate_password(&password)?;
            Some(auth::hash_password(password).await?)
        }
        None => None,
    };

    let mut tx = state.db.begin().await?;
    let supers_before = super_user_ids(&mut tx).await?;

    if let Some(email) = &email {
        let result = sqlx::query("UPDATE users SET email = $1 WHERE id = $2")
            .bind(email)
            .bind(id)
            .execute(&mut *tx)
            .await;
        match result {
            Ok(_) => {}
            Err(sqlx::Error::Database(e)) if e.is_unique_violation() => return Err(email_taken()),
            Err(e) => return Err(e.into()),
        }
        if *email != target.email {
            details["email"] = json!({ "from": target.email, "to": email });
            // A reset link sent to the old address must stop working.
            sqlx::query("DELETE FROM password_resets WHERE user_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
    }

    if let Some(role_ids) = &role_ids {
        set_roles(&mut tx, id, role_ids).await?;
    }
    if let Some(super_user) = super_change {
        sqlx::query("UPDATE users SET super_user = $1 WHERE id = $2")
            .bind(super_user)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        details["super_user"] = json!({ "from": target.super_user, "to": super_user });
    }
    if let Some(suspended) = suspend_change {
        sqlx::query("UPDATE users SET suspended = $1 WHERE id = $2")
            .bind(suspended)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        if suspended {
            // Signed out everywhere at once, not only at the next sign-in.
            sqlx::query("DELETE FROM sessions WHERE user_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        details["suspended"] = json!({ "from": target.suspended, "to": suspended });
    }
    if let Some(required) = body.two_factor_required.filter(|value| *value != target.two_factor_required) {
        sqlx::query("UPDATE users SET two_factor_required = $1 WHERE id = $2")
            .bind(required)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        details["two_factor_required"] = json!({ "from": target.two_factor_required, "to": required });
    }
    if role_ids.is_some() || super_change.is_some() {
        ensure_super_user_left(&mut tx, &user).await?;
        ensure_supers_kept(&mut tx, &user, &supers_before).await?;
    }

    if let Some(permissions) = &permissions {
        sqlx::query("UPDATE users SET permissions = $1 WHERE id = $2")
            .bind(permissions)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        let added: Vec<&String> = permissions.iter().filter(|p| !target.permissions.contains(p)).collect();
        let removed: Vec<&String> = target.permissions.iter().filter(|p| !permissions.contains(p)).collect();
        if !added.is_empty() {
            details["permissions_added"] = json!(added);
        }
        if !removed.is_empty() {
            details["permissions_removed"] = json!(removed);
        }
    }

    if let Some(hash) = &password_hash {
        sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
            .bind(hash)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        if id != user.id {
            sqlx::query("DELETE FROM sessions WHERE user_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        details["password_changed"] = json!(true);
    }

    tx.commit().await?;

    let roles_after = role_names(&state.db, id).await;
    if roles_after != roles_before {
        details["roles"] = json!({ "from": roles_before, "to": roles_after });
    }
    let password_changed = details.get("password_changed").is_some();
    let email_changed = details.get("email").is_some();
    activity::record(&state.db, &user, "users", "edited user", None, &target.username, Some(details)).await;
    if id != user.id {
        if password_changed {
            let change = Change::ChangedBy { admin: user.username.clone(), what: "password" };
            security_mail::notify(&state.db, id, change, user.ip.clone(), None);
        }
        if email_changed {
            let change = Change::ChangedBy { admin: user.username.clone(), what: "email address" };
            security_mail::notify(&state.db, id, change, user.ip.clone(), target.email.clone());
        }
    }
    let after = find_user(&state.db, id).await?;
    if after.is_admin != target.is_admin {
        let what = if after.is_admin { "made {name} an admin" } else { "took admin away from {name}" };
        let title = format!("{} {}", user.username, what.replace("{name}", &target.username));
        admin_notice(&state.db, &user, "admin_security", title, "/manage/users");
    }
    if after.suspended != target.suspended {
        let what = if after.suspended { "suspended" } else { "unsuspended" };
        let title = format!("{} {what} the user {}", user.username, target.username);
        admin_notice(&state.db, &user, "admin_users", title, "/manage/users");
    }
    Ok(Json(after))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("users.delete")?;
    let target = find_user(&state.db, id).await?;

    if target.id == user.id {
        return Err(ApiError::BadRequest("You can't delete your own account".into()));
    }
    require_rank(&user, &target)?;
    require_reach(&state.db, &user, id).await?;
    let roles_before = role_names(&state.db, id).await;

    let mut tx = state.db.begin().await?;
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    ensure_super_user_left(&mut tx, &user).await?;
    tx.commit().await?;

    let details = json!({ "email": target.email, "roles": roles_before });
    activity::record(&state.db, &user, "users", "deleted user", None, &target.username, Some(details)).await;
    let title = format!("{} deleted the user {}", user.username, target.username);
    if target.is_admin {
        admin_notice(&state.db, &user, "admin_security", title, "/manage/users");
    } else {
        admin_notice(&state.db, &user, "admin_users", title, "/manage/users");
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Mails an admin notice about a change someone made in the panel.
pub(super) fn admin_notice(db: &sqlx::PgPool, actor: &CurrentUser, kind: &'static str, title: String, path: &'static str) {
    let mut fields = vec![("By", actor.username.clone())];
    if let Some(ip) = &actor.ip {
        fields.push(("IP address", ip.clone()));
    }
    crate::notifications::notify_admins(
        db,
        crate::notifications::AdminNotice {
            kind,
            title,
            description: "This was done in the panel. If you didn't expect it, check the activity log.".to_string(),
            fields,
            path,
            actor: Some(actor.id),
        },
    );
}

/// Turns off someone's authenticator app and email codes, for when they lost
/// their phone. Their recovery codes go too; passkeys stay.
pub async fn reset_two_factor(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require("users.edit")?;
    let target = find_user(&state.db, id).await?;
    if target.id == user.id {
        return Err(ApiError::BadRequest("Change your own two-factor sign-in on your profile".into()));
    }
    require_rank(&user, &target)?;
    require_reach(&state.db, &user, id).await?;
    let mut tx = state.db.begin().await?;
    sqlx::query("UPDATE users SET totp_secret = NULL, totp_last_step = NULL, email_two_factor = false WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM recovery_codes WHERE user_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    activity::record(&state.db, &user, "users", "reset two-factor sign-in of", None, &target.username, None).await;
    let title = format!("{} reset the two-factor sign-in of {}", user.username, target.username);
    admin_notice(&state.db, &user, "admin_security", title, "/manage/users");
    security_mail::notify(&state.db, id, Change::TwoFactorResetBy { admin: user.username.clone() }, None, None);
    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_admin_from_cli(pool: &sqlx::PgPool, username: &str, password: String) -> anyhow::Result<()> {
    let username = username.trim().to_lowercase();
    validate_username(&username).map_err(|e| anyhow::anyhow!(error_text(e)))?;
    validate_password(&password).map_err(|e| anyhow::anyhow!(error_text(e)))?;

    let password_hash = auth::hash_password(password).await?;
    sqlx::query(
        r#"
        INSERT INTO users (username, password_hash, owner, super_user)
        VALUES ($1, $2, true, true)
        ON CONFLICT (username) DO UPDATE
            SET password_hash = EXCLUDED.password_hash, owner = true, super_user = true, suspended = false
        "#,
    )
    .bind(&username)
    .bind(&password_hash)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn reset_password_from_cli(pool: &sqlx::PgPool, username: &str, password: String) -> anyhow::Result<()> {
    let username = username.trim().to_lowercase();
    validate_password(&password).map_err(|e| anyhow::anyhow!(error_text(e)))?;

    let user: Option<(i64,)> = sqlx::query_as("SELECT id FROM users WHERE username = $1 OR lower(email) = $1")
        .bind(&username)
        .fetch_optional(pool)
        .await?;
    let (id,) = user.ok_or_else(|| anyhow::anyhow!("No account with username or email '{username}'"))?;

    let password_hash = auth::hash_password(password).await?;
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&password_hash)
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

fn error_text(error: ApiError) -> String {
    match error {
        ApiError::BadRequest(message) | ApiError::Conflict(message) => message,
        other => format!("{other:?}"),
    }
}
