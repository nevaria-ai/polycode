use serde::de::DeserializeOwned;
use serde::Serialize;

use ffi::{check_code, CallCtx, FfiStatusCode, TransportError};

use crate::cgo::{transcript_op_into, workspace_op_into};

use super::handle::{DbError, DbHandle};

type OpFn = unsafe extern "C" fn(usize, *mut ffi::CallCtxHeader) -> i32;

const SCRATCH_INITIAL: usize = 8 * 1024;
const SCRATCH_MAX: usize = 8 * 1024 * 1024;

impl DbHandle {
    pub fn workspace(&self, op: &str, args: &impl Serialize) -> Result<String, DbError> {
        self.call_op(workspace_op_into, op, args)
    }

    pub fn transcript(&self, op: &str, args: &impl Serialize) -> Result<String, DbError> {
        self.call_op(transcript_op_into, op, args)
    }

    pub fn workspace_one<T: DeserializeOwned>(
        &self,
        op: &str,
        args: &impl Serialize,
    ) -> Result<T, DbError> {
        decode_one(&self.workspace(op, args)?)
    }

    pub fn workspace_many<T: DeserializeOwned>(
        &self,
        op: &str,
        args: &impl Serialize,
    ) -> Result<Vec<T>, DbError> {
        decode_many(&self.workspace(op, args)?)
    }

    pub fn transcript_one<T: DeserializeOwned>(
        &self,
        op: &str,
        args: &impl Serialize,
    ) -> Result<T, DbError> {
        decode_one(&self.transcript(op, args)?)
    }

    pub fn transcript_many<T: DeserializeOwned>(
        &self,
        op: &str,
        args: &impl Serialize,
    ) -> Result<Vec<T>, DbError> {
        decode_many(&self.transcript(op, args)?)
    }

    pub fn workspace_optional<T: DeserializeOwned>(
        &self,
        op: &str,
        args: &impl Serialize,
    ) -> Result<Option<T>, DbError> {
        match self.workspace_one(op, args) {
            Err(e) if is_not_found(&e) => Ok(None),
            Err(e) => Err(e),
            Ok(v) => Ok(Some(v)),
        }
    }

    pub fn transcript_optional<T: DeserializeOwned>(
        &self,
        op: &str,
        args: &impl Serialize,
    ) -> Result<Option<T>, DbError> {
        match self.transcript_one(op, args) {
            Err(e) if is_not_found(&e) => Ok(None),
            Err(e) => Err(e),
            Ok(v) => Ok(Some(v)),
        }
    }

    fn call_op(&self, op_fn: OpFn, op: &str, args: &impl Serialize) -> Result<String, DbError> {
        let args_json = serde_json::to_string(args)
            .map_err(|e| DbError::msg(format!("serialize args: {e}")))?;

        let mut call_ctx = CallCtx::with_scratch_cap(SCRATCH_INITIAL);

        loop {
            let payload = format!("{op}\n{args_json}");
            call_ctx.prepare_input(&payload);
            let code = unsafe { op_fn(self.raw_handle(), call_ctx.as_mut_ptr()) };

            match FfiStatusCode::from_raw(code as u32) {
                FfiStatusCode::Ok => {
                    return call_ctx
                        .read_output_string()
                        .map_err(|e| db_error_from_parse(op, e));
                }
                FfiStatusCode::BufferTooSmall => {
                    let next = call_ctx
                        .scratch_cap()
                        .saturating_mul(2)
                        .max(SCRATCH_INITIAL);
                    if next > SCRATCH_MAX {
                        return Err(DbError::msg(format!(
                            "{op}: response exceeds max scratch ({SCRATCH_MAX} bytes)"
                        )));
                    }
                    call_ctx.grow_scratch(next);
                }
                other => {
                    return match check_code(code as u32, &call_ctx) {
                        Ok(()) => Err(DbError::msg(format!("{op}: ffi status {other:?}"))),
                        Err(e) => Err(db_error_from_transport(op, e)),
                    };
                }
            }
        }
    }
}

fn db_error_from_transport(op: &str, e: TransportError) -> DbError {
    DbError::msg(format!("{op}: {e}"))
}

fn db_error_from_parse(op: &str, e: ffi::ParseError) -> DbError {
    DbError::msg(format!("{op}: {e}"))
}

fn decode_one<T: DeserializeOwned>(json: &str) -> Result<T, DbError> {
    serde_json::from_str(json).map_err(|e| DbError::msg(format!("decode response: {e}")))
}

fn decode_many<T: DeserializeOwned>(json: &str) -> Result<Vec<T>, DbError> {
    if json.trim() == "null" {
        return Ok(Vec::new());
    }
    serde_json::from_str(json).map_err(|e| DbError::msg(format!("decode response: {e}")))
}

/// `sql.ErrNoRows` from Go/sqlc surfaces in transport or error text.
pub fn is_not_found(err: &DbError) -> bool {
    err.message.contains("no rows in result set")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_memory_list_projects() {
        let db = DbHandle::open_memory().expect("open memory db");
        let projects: Vec<serde_json::Value> = db
            .workspace_many("ListProjects", &serde_json::json!({}))
            .expect("list projects");
        assert!(projects.is_empty());
    }
}
