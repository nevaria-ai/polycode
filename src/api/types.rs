use serde::{Deserialize, Serialize};

pub fn format_iso8601(epoch_secs: i64) -> String {
    chrono::DateTime::from_timestamp(epoch_secs, 0)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub expanded_state: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiWorktree {
    pub id: String,
    pub project_id: String,
    pub path: String,
    pub name: String,
    pub is_primary: bool,
    pub branch: Option<String>,
    pub last_synced_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiSession {
    pub id: String,
    pub project_id: String,
    pub worktree_id: Option<String>,
    pub worktree_path: String,
    pub title: Option<String>,
    pub status: String,
    pub version: i64,
    pub has_summary: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_active_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub position: i64,
    pub content: String,
    pub provider_run_id: Option<String>,
    pub created_at: String,
    pub parts: Vec<ApiPart>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiPart {
    pub id: String,
    pub message_id: String,
    pub r#type: String,
    pub content: String,
    pub position: i64,
    pub provider_run_id: Option<String>,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiPinnedContext {
    pub id: String,
    pub r#type: String,
    pub source: String,
    pub resolved_path: Option<String>,
    pub content: String,
    pub metadata: Option<String>,
    pub pinned_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiProviderRun {
    pub id: String,
    pub adapter_type: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    pub worktree_path: String,
    pub worktree_id: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTitleRequest {
    pub title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSessionRequest {}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitMessageRequest {
    pub content: String,
    pub mentions: Option<Vec<MentionInput>>,
    pub slash_command: Option<SlashCommandInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MentionInput {
    pub r#type: String,
    pub r#ref: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandInput {
    pub command: String,
    pub argument: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExpandedStateRequest {
    pub expanded_state: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectResponse {
    pub project: ApiProject,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    pub session: ApiSession,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionResponse {
    pub session: ApiSession,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeResponse {
    pub worktree: ApiWorktree,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionViewResponse {
    pub session: ApiSession,
    pub messages: Vec<ApiMessage>,
    pub pinned_context: Vec<ApiPinnedContext>,
    pub has_summary: bool,
    pub provider_runs: Vec<ApiProviderRun>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryResponse {
    pub suggestions: Vec<String>,
    pub exists: bool,
}

use crate::api::projects::Project as DbProject;
use crate::api::sessions::Session as DbSession;

impl From<DbSession> for ApiSession {
    fn from(s: DbSession) -> Self {
        Self {
            id: s.id,
            project_id: s.project_id,
            worktree_id: s.worktree_id,
            worktree_path: s.worktree_path,
            title: s.title,
            status: s.status,
            version: s.version,
            has_summary: s.has_summary != 0,
            created_at: format_iso8601(s.created_at),
            updated_at: format_iso8601(s.updated_at),
            last_active_at: format_iso8601(s.last_active_at),
        }
    }
}

impl From<DbProject> for ApiProject {
    fn from(p: DbProject) -> Self {
        Self {
            id: p.id,
            name: p.name,
            path: p.path,
            expanded_state: p.expanded_state,
            created_at: format_iso8601(p.created_at),
        }
    }
}
