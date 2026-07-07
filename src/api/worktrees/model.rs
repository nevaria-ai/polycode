use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeRow {
    pub id: String,
    pub project_id: String,
    pub path: String,
    #[serde(deserialize_with = "crate::api::serde_sqlite::bool_from_int")]
    pub is_linked_worktree: bool,
    pub created_at: i64,
}
