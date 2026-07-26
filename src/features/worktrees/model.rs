use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeRow {
    pub id: String,
    pub project_id: String,
    pub path: String,
    #[serde(
        serialize_with = "crate::serde_sqlite::bool_to_int",
        deserialize_with = "crate::serde_sqlite::bool_from_int"
    )]
    pub is_linked_worktree: bool,
    #[serde(
        serialize_with = "crate::serde_sqlite::bool_to_int",
        deserialize_with = "crate::serde_sqlite::bool_from_int"
    )]
    pub expanded_state: bool,
    pub created_at: i64,
}

/// Args for `UpdateWorktreeExpandedState` (partial write, not a full row).
#[derive(Debug, Serialize)]
pub struct UpdateWorktreeExpandedStateArgs<'a> {
    pub id: &'a str,
    #[serde(serialize_with = "crate::serde_sqlite::bool_to_int")]
    pub expanded_state: bool,
}
