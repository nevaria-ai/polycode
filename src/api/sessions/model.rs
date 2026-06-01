use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub worktree_id: Option<String>,
    pub worktree_path: String,
    pub title: Option<String>,
    pub status: String,
    pub version: i64,
    pub has_summary: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_active_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateSession {
    pub project_id: String,
    pub worktree_path: String,
    pub worktree_id: Option<String>,
    pub title: Option<String>,
}
