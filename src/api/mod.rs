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
