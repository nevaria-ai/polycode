//! Polycode `cgo/` exports — layouts from `github.com/codeignus/ffi/types.h`.

use ffi::CallCtxHeader;

use std::os::raw::c_int;

unsafe extern "C" {
    pub fn db_open(path: *const std::os::raw::c_char) -> usize;
    pub fn db_open_memory() -> usize;
    pub fn db_close(handle: usize);
    pub fn workspace_op_into(handle: usize, ctx: *mut CallCtxHeader) -> c_int;
    pub fn transcript_op_into(handle: usize, ctx: *mut CallCtxHeader) -> c_int;
}
