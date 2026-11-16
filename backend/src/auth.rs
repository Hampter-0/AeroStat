use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use std::sync::LazyLock;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::HeaderMap;
use rand::RngCore;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::error::ApiError;
use crate::state::AppState;

#[derive(Serialize)]
pub struct Permission {
    pub key: &'static str,
    pub label: &'static str,
    pub hint: &'static str,
    /// Needed before this one makes sense, like viewing before editing.
    pub parent: Option<&'static str>,
}

#[derive(Serialize)]
pub struct PermissionGroup {
    pub key: &'static str,
    pub label: &'static str,
    pub permissions: &'static [Permission],
}

const fn perm(key: &'static str, label: &'static str, hint: &'static str, parent: Option<&'static str>) -> Permission {
    Permission { key, label, hint, parent }
}

/// Every permission a role can hold, grouped the way the panel shows them.
pub static PERMISSION_GROUPS: &[PermissionGroup] = &[
    PermissionGroup {
        key: "incidents",
        label: "Incidents",
        permissions: &[
            perm("incidents.view", "View incidents", "Open incidents in the panel.", None),
            perm("incidents.create", "Create incidents", "Post a new incident.", Some("incidents.view")),
            perm("incidents.update", "Post updates", "Add updates to an incident's timeline.", Some("incidents.view")),
            perm("incidents.edit", "Edit incidents", "Change the details and edit or remove timeline updates.", Some("incidents.view")),
            perm("incidents.delete", "Delete incidents", "Remove an incident for good.", Some("incidents.view")),
        ],
    },
    PermissionGroup {
        key: "maintenance",
        label: "Maintenance",
        permissions: &[
            perm("maintenance.view", "View maintenance", "Open maintenance in the panel.", None),
            perm("maintenance.create", "Schedule maintenance", "Plan a new maintenance window.", Some("maintenance.view")),
            perm("maintenance.update", "Post updates", "Add updates to a maintenance timeline.", Some("maintenance.view")),
            perm("maintenance.edit", "Edit maintenance", "Change the details and edit or remove timeline updates.", Some("maintenance.view")),
            perm("maintenance.cancel", "Cancel and reactivate", "Cancel planned maintenance or bring it back.", Some("maintenance.view")),
            perm("maintenance.delete", "Delete maintenance", "Remove maintenance for good.", Some("maintenance.view")),
        ],
    },
    PermissionGroup {
        key: "services",
        label: "Services",
        permissions: &[
            perm("services.view", "View services", "See the services and their checks in the panel.", None),
            perm("services.create", "Add services", "Add a new service to check.", Some("services.view")),
            perm("services.edit", "Edit services", "Change a service and its place in the list.", Some("services.view")),
            perm("services.delete", "Delete services", "Remove a service and its check history.", Some("services.view")),
            perm("services.check", "Check now", "Run all checks right away.", Some("services.view")),
        ],
    },
    PermissionGroup {
        key: "groups",
        label: "Service groups",
        permissions: &[
            perm("groups.create", "Add groups", "Add a new group of services.", Some("services.view")),
            perm("groups.edit", "Edit groups", "Rename groups and change their order.", Some("services.view")),
            perm("groups.delete", "Delete groups", "Remove a group; its services move to Other.", Some("services.view")),
        ],
    },
    PermissionGroup {
        key: "settings",
        label: "Settings",
        permissions: &[
            perm("settings.general", "Site settings", "Name, branding, time and region.", None),
            perm("settings.notifications", "Notifications", "The Discord webhook and which events it gets.", None),
        ],
    },
    PermissionGroup {
        key: "activity",
        label: "Activity",
        permissions: &[perm(
            "activity.view",
            "View activity",
            "The activity log and recent activity on the dashboard, for the parts this role can see.",
            None,
        )],
    },
    PermissionGroup {
        key: "system",
        label: "System",
        permissions: &[
            perm("system.view", "View system", "Server info, version, updates and health.", None),
            perm("system.email", "Email settings", "See the mail server settings and send a test email.", Some("system.view")),
        ],
    },
    PermissionGroup {
        key: "users",
        label: "Users",
        permissions: &[
            perm("users.view", "View users", "See who can sign in, their roles and their sign-ins in the activity log.", None),
            perm("users.create", "Create users", "Add a new account.", Some("users.view")),
            perm("users.edit", "Edit users", "Change email, password, roles and extra permissions.", Some("users.view")),
            perm("users.delete", "Delete users", "Remove an account.", Some("users.view")),
        ],
    },
    PermissionGroup {
        key: "roles",
        label: "Roles",
        permissions: &[
            perm("roles.view", "View roles", "See the roles and what they allow.", None),
            perm("roles.create", "Create roles", "Add a new role.", Some("roles.view")),
            perm("roles.edit", "Edit roles", "Change a role's name and permissions.", Some("roles.view")),
            perm("roles.delete", "Delete roles", "Remove a role from everyone who has it.", Some("roles.view")),
        ],
    },
];

fn find_permission(key: &str) -> Option<&'static Permission> {
    PERMISSION_GROUPS
        .iter()
        .flat_map(|group| group.permissions.iter())
        .find(|permission| permission.key == key)
}

/// Checks every key and adds the permissions they depend on, sorted and
/// without duplicates.
pub fn normalize_permissions(permissions: &[String]) -> Result<Vec<String>, ApiError> {
    let mut result: Vec<String> = Vec::new();
    for key in permissions {
        let first = find_permission(key).ok_or_else(|| ApiError::BadRequest(format!("Unknown permission: {key}")))?;
        let mut current = Some(first);
        while let Some(permission) = current {
            if !result.iter().any(|existing| existing == permission.key) {
                result.push(permission.key.to_string());
            }
            current = permission.parent.and_then(find_permission);
        }
    }
    result.sort();
    Ok(result)
}

/// Checked against when a login matches no account, so an unknown username
/// takes as long to refuse as a wrong password.
static DUMMY_HASH: LazyLock<String> = LazyLock::new(|| {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(b"not-a-real-password", &salt)
        .map(|hash| hash.to_string())
        .unwrap_or_default()
});

pub fn dummy_hash() -> String {
    DUMMY_HASH.clone()
}

pub async fn hash_password(password: String) -> anyhow::Result<String> {
    tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| anyhow::anyhow!("hashing failed: {e}"))
    })
    .await?
}

pub async fn verify_password(password: String, hash: String) -> bool {
    tokio::task::spawn_blocking(move || match PasswordHash::new(&hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    })
    .await
    .unwrap_or(false)
}

/// Returns (token for the client, hash to store). Only the hash ever hits the database.
pub fn new_session_token() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    let hash = hash_token(&token);
    (token, hash)
}

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CurrentUser {
    pub id: i64,
    pub username: String,
    pub email: Option<String>,
    /// True when the user is a super user, directly or through a role.
    pub is_admin: bool,
    /// Everything the user's roles and extra permissions allow together.
    pub permissions: Vec<String>,
    pub roles: Vec<String>,
    /// The entries of `roles` that make the user a super user.
    pub super_roles: Vec<String>,
    /// Permissions given to the user directly, next to their roles.
    pub extra_permissions: Vec<String>,
    pub avatar_version: Option<i64>,
}

/// Columns for loading a CurrentUser from the users table aliased as `u`.
pub const CURRENT_USER_COLUMNS: &str = "u.id, u.username, u.email, \
     user_is_super(u.id) AS is_admin, user_permissions(u.id) AS permissions, \
     (CASE WHEN u.super_user THEN ARRAY['Super user'] ELSE ARRAY[]::text[] END || ARRAY(SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id ORDER BY r.name)) AS roles, \
     (CASE WHEN u.super_user THEN ARRAY['Super user'] ELSE ARRAY[]::text[] END || ARRAY(SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.super_user ORDER BY r.name)) AS super_roles, \
     u.permissions AS extra_permissions, \
     EXTRACT(EPOCH FROM u.avatar_updated_at)::bigint AS avatar_version";

pub async fn load_user(db: &sqlx::PgPool, id: i64) -> Result<CurrentUser, ApiError> {
    let query = format!("SELECT {CURRENT_USER_COLUMNS} FROM users u WHERE u.id = $1");
    let user: Option<CurrentUser> = sqlx::query_as(&query).bind(id).fetch_optional(db).await?;
    user.ok_or(ApiError::NotFound)
}

impl CurrentUser {
    pub fn require(&self, permission: &str) -> Result<(), ApiError> {
        if self.is_admin || self.permissions.iter().any(|p| p == permission) {
            return Ok(());
        }
        Err(ApiError::Forbidden)
    }

    pub fn has(&self, permission: &str) -> bool {
        self.is_admin || self.permissions.iter().any(|p| p == permission)
    }

    /// Whether this user already holds everything a role grants, so handing it
    /// out can't give anyone more than this user has.
    pub fn covers(&self, super_user: bool, permissions: &[String]) -> bool {
        if self.is_admin {
            return true;
        }
        !super_user && permissions.iter().all(|permission| self.has(permission))
    }
}

pub fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let header = headers.get(axum::http::header::AUTHORIZATION)?;
    let value = header.to_str().ok()?;
    value.strip_prefix("Bearer ").map(|token| token.trim().to_string())
}

#[axum::async_trait]
impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer_token(&parts.headers).ok_or(ApiError::Unauthorized)?;

        let query = format!(
            "SELECT {CURRENT_USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()"
        );
        let user: Option<CurrentUser> = sqlx::query_as(&query)
        .bind(hash_token(&token))
        .fetch_optional(&state.db)
        .await?;

        user.ok_or(ApiError::Unauthorized)
    }
}
