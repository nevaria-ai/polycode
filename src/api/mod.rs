use axum::routing::get;
use axum::Router;

use crate::db::DbHandle;

pub mod directories;
pub mod messages;
pub mod projects;
pub mod serde_sqlite;
pub mod sessions;
pub mod types;
pub mod worktrees;

#[derive(Clone)]
pub struct AppState {
    pub db: DbHandle,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/health", get(|| async { "ok" }))
        .merge(projects::router())
        .merge(sessions::router())
        .merge(messages::router())
        .merge(directories::router())
        .merge(worktrees::router())
}
