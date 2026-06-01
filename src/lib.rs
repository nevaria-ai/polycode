#[cfg(test)]
mod test_support;

extern crate self as polycode;

pub mod api;
pub mod embed;

pub mod cgo;
pub mod db;
pub mod error;
pub mod git;
pub mod paths;
pub mod utils;

#[path = "bin/web.rs"]
pub mod web;
