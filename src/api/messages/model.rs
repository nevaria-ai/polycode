use serde::{Deserialize, Serialize};

use crate::api::types::{format_iso8601, ApiMessage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub position: i64,
    pub content: String,
    pub provider_run_id: Option<String>,
    pub created_at: i64,
}

impl From<Message> for ApiMessage {
    fn from(m: Message) -> Self {
        Self {
            id: m.id,
            session_id: m.session_id,
            role: m.role,
            position: m.position,
            content: m.content,
            provider_run_id: m.provider_run_id,
            created_at: format_iso8601(m.created_at),
            parts: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part {
    pub id: String,
    pub message_id: String,
    pub session_id: String,
    #[serde(rename = "type")]
    pub part_type: String,
    pub content: String,
    pub position: i64,
    pub metadata: Option<String>,
    pub provider_run_id: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessage {
    pub session_id: String,
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePart {
    pub message_id: String,
    pub session_id: String,
    #[serde(rename = "type")]
    pub part_type: String,
    pub content: String,
    pub position: i64,
    pub metadata: Option<String>,
}
