use std::ffi::CString;
use std::path::Path;
use std::sync::Arc;

use crate::cgo::{db_close, db_open, db_open_memory};

#[derive(Debug, Clone)]
pub struct DbError {
    pub message: String,
}

impl DbError {
    pub(crate) fn msg(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for DbError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for DbError {}

#[derive(Clone)]
pub struct DbHandle(Arc<Inner>);

struct Inner {
    handle: usize,
}

impl DbHandle {
    pub fn open(path: &Path) -> Result<Self, DbError> {
        let c_path = CString::new(path.to_string_lossy().as_ref())
            .map_err(|_| DbError::msg("database path contains interior nul"))?;
        let handle = unsafe { db_open(c_path.as_ptr()) };
        if handle == 0 {
            return Err(DbError::msg(format!(
                "db_open failed for {}",
                path.display()
            )));
        }
        Ok(Self(Arc::new(Inner { handle })))
    }

    pub fn open_memory() -> Result<Self, DbError> {
        let handle = unsafe { db_open_memory() };
        if handle == 0 {
            return Err(DbError::msg("db_open_memory failed"));
        }
        Ok(Self(Arc::new(Inner { handle })))
    }

    pub(crate) fn raw_handle(&self) -> usize {
        self.0.handle
    }
}

impl Drop for Inner {
    fn drop(&mut self) {
        unsafe { db_close(self.handle) };
    }
}
