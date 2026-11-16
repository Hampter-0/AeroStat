mod activity;
mod backups;
mod dashboard;
mod email;
mod incidents;
mod maintenance;
mod notifications;
mod passkeys;
mod password_reset;
mod profile;
mod roles;
mod services;
mod session;
mod sessions;
mod settings;
mod system;
mod two_factor;
mod users;
mod version;

use axum::routing::{delete, get, patch, post, put};
use axum::Router;

use crate::state::AppState;

pub use users::{create_admin_from_cli, reset_password_from_cli};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(session::login))
        .route("/login/options", get(passkeys::login_options))
        .route("/login/two-factor", post(two_factor::verify_login))
        .route("/login/two-factor/email", post(two_factor::send_login_code))
        .route("/login/passkey", post(passkeys::start_login))
        .route("/password-reset", post(password_reset::request))
        .route("/password-reset/check", get(password_reset::check))
        .route("/password-reset/confirm", post(password_reset::confirm))
        .route("/login/passkey/finish", post(passkeys::finish_login))
        .route("/logout", post(session::logout))
        .route("/me", get(session::me))
        .route("/version", get(version::get))
        .route("/backups", get(backups::list).post(backups::create))
        .route(
            "/backups/upload",
            post(backups::upload).layer(axum::extract::DefaultBodyLimit::max(crate::backups::MAX_UPLOAD_BYTES as usize)),
        )
        .route("/backups/:id", delete(backups::delete))
        .route("/backups/:id/download", get(backups::download))
        .route("/version/check", post(version::check))
        .route("/system", get(system::get))
        .route("/profile", patch(profile::update))
        .route("/profile/password", post(profile::change_password))
        .route("/profile/sessions", get(sessions::list))
        .route("/profile/passkeys", get(passkeys::list).post(passkeys::start_registration))
        .route("/profile/passkeys/finish", post(passkeys::finish_registration))
        .route("/profile/passkeys/:id", delete(passkeys::delete))
        .route("/profile/password-login", put(passkeys::set_password_login))
        .route("/profile/two-factor", get(two_factor::status))
        .route("/profile/two-factor/app", post(two_factor::start_app))
        .route("/profile/two-factor/app/confirm", post(two_factor::confirm_app))
        .route("/profile/two-factor/app/disable", post(two_factor::disable_app))
        .route("/profile/two-factor/email", post(two_factor::start_email))
        .route("/profile/two-factor/email/confirm", post(two_factor::confirm_email))
        .route("/profile/two-factor/email/disable", post(two_factor::disable_email))
        .route("/profile/two-factor/recovery", post(two_factor::new_recovery_codes))
        .route("/profile/sessions/others", delete(sessions::end_others))
        .route("/profile/sessions/:id", delete(sessions::end))
        .route(
            "/profile/notifications",
            get(email::my_notifications).put(email::update_my_notifications),
        )
        .route("/profile/avatar", put(profile::upload_avatar).delete(profile::delete_avatar))
        .route("/avatar/:id", get(profile::avatar))
        .route("/dashboard", get(dashboard::get))
        .route("/activity", get(activity::list))
        .route("/users", get(users::list).post(users::create))
        .route("/roles", get(roles::list).post(roles::create))
        .route("/roles/:id", get(roles::get).patch(roles::update).delete(roles::delete))
        .route("/users/:id", patch(users::update).delete(users::delete))
        .route("/users/:id/reset-two-factor", post(users::reset_two_factor))
        .route("/incidents", post(incidents::create))
        .route("/incidents/:id", patch(incidents::update).delete(incidents::delete))
        .route("/incidents/:id/updates", post(incidents::add_update))
        .route(
            "/incidents/:id/updates/:update_id",
            patch(incidents::edit_update).delete(incidents::delete_update),
        )
        .route("/services", get(services::list).post(services::create))
        .route("/services/check-now", post(services::check_now))
        .route("/services/:id", patch(services::update).delete(services::delete))
        .route("/services/:id/move", post(services::move_service))
        .route("/settings", get(settings::get).patch(settings::update))
        .route("/notifications", get(notifications::get).put(notifications::update))
        .route("/notifications/test", post(notifications::test))
        .route("/email", get(email::get))
        .route("/email/test", post(email::test))
        .route("/brand/:name", put(settings::upload_asset).delete(settings::delete_asset))
        .route("/groups", post(services::create_group))
        .route("/groups/:id", patch(services::update_group).delete(services::delete_group))
        .route("/groups/:id/move", post(services::move_group))
        .route("/maintenance", post(maintenance::create))
        .route("/maintenance/:id", patch(maintenance::update).delete(maintenance::delete))
        .route("/maintenance/:id/cancel", post(maintenance::cancel))
        .route("/maintenance/:id/reactivate", post(maintenance::reactivate))
        .route("/maintenance/:id/updates", post(maintenance::add_update))
        .route(
            "/maintenance/:id/updates/:update_id",
            patch(maintenance::edit_update).delete(maintenance::delete_update),
        )
}
