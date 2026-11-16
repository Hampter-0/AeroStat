use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::error::ApiError;
use crate::state::AppState;

#[derive(Serialize, sqlx::FromRow)]
pub struct ShareCard {
    icon: String,
    color: String,
    headline: String,
    subline: String,
}

/// The saved picture of one notification, drawn by the frontend at /og/card/<id>.
pub async fn get(State(state): State<AppState>, Path(id): Path<String>) -> Result<Json<ShareCard>, ApiError> {
    if id.len() != 32 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ApiError::NotFound);
    }
    let card: Option<ShareCard> = sqlx::query_as("SELECT icon, color, headline, subline FROM share_cards WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    card.map(Json).ok_or(ApiError::NotFound)
}
