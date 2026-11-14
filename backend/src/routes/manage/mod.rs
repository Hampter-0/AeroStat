mod incidents;
mod maintenance;
mod session;
mod users;

use axum::routing::{get, patch, post};
use axum::Router;

use crate::state::AppState;

pub use users::{create_admin_from_cli, reset_password_from_cli};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(session::login))
        .route("/logout", post(session::logout))
        .route("/me", get(session::me))
        .route("/users", get(users::list).post(users::create))
        .route("/users/:id", patch(users::update).delete(users::delete))
        .route("/incidents", post(incidents::create))
        .route("/incidents/:id", patch(incidents::update).delete(incidents::delete))
        .route("/incidents/:id/updates", post(incidents::add_update))
        .route(
            "/incidents/:id/updates/:update_id",
            patch(incidents::edit_update).delete(incidents::delete_update),
        )
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
