//! Messages feature module.

mod model;
mod service;

pub use model::{Message, Part};
pub use service::{SendMessageRequest, Service};
