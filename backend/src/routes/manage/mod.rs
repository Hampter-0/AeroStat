mod activity;
mod dashboard;
mod incidents;
mod maintenance;
mod profile;
mod services;
mod session;
mod settings;
mod system;
mod users;
mod version;

use axum::routing::{get, patch, post, put};
use axum::Router;

use crate::state::AppState;

pub use users::{create_admin_from_cli, reset_password_from_cli};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(session::login))
        .route("/logout", post(session::logout))
        .route("/me", get(session::me))
        .route("/version", get(version::get))
        .route("/version/check", post(version::check))
        .route("/system", get(system::get))
        .route("/profile", patch(profile::update))
        .route("/profile/password", post(profile::change_password))
        .route("/profile/avatar", put(profile::upload_avatar).delete(profile::delete_avatar))
        .route("/avatar/:id", get(profile::avatar))
        .route("/dashboard", get(dashboard::get))
        .route("/activity", get(activity::list))
        .route("/users", get(users::list).post(users::create))
        .route("/users/:id", patch(users::update).delete(users::delete))
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
