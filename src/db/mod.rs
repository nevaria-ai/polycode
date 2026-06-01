//! Database via Go/sqlc FFI (`DbHandle`).

mod handle;
mod ops;

use crate::paths;

pub use handle::{DbError, DbHandle};
pub use ops::is_not_found;

/// Open the on-disk user database (Go runs migrations).
pub fn init_db() -> Result<DbHandle, DbError> {
    let dir = paths::data_dir();
    std::fs::create_dir_all(&dir).ok();
    DbHandle::open(&paths::db_path())
}

/// In-memory database (Go runs migrations). Intended for `cargo test` / debug builds.
#[cfg(debug_assertions)]
pub fn init_memory() -> Result<DbHandle, DbError> {
    DbHandle::open_memory()
}
