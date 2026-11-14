mod session;
mod users;

use axum::routing::{get, patch, post};
use axum::Router;

use crate::state::AppState;

pub use users::create_admin_from_cli;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(session::login))
        .route("/logout", post(session::logout))
        .route("/me", get(session::me))
        .route("/users", get(users::list).post(users::create))
        .route("/users/:id", patch(users::update).delete(users::delete))
}
