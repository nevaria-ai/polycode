use serde::{Deserialize, Serialize};

use crate::features::sessions::{Session as DbSession, SessionMetadata};

pub fn format_iso8601(epoch_secs: i64) -> String {
    chrono::DateTime::from_timestamp(epoch_secs, 0)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

/// Slim session row for sidebar nesting under worktrees.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummaryDto {
    pub id: String,
    pub title: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_active_at: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDto {
    pub id: String,
    pub branch: Option<String>,
    pub is_linked_worktree: bool,
    pub expanded_state: bool,
    pub sessions: Vec<SessionSummaryDto>,
}

/// Project with nested worktrees and session metadata for the sidebar.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDto {
    pub id: String,
    pub path: String,
    pub created_at: String,
    pub display_name: String,
    pub owner: Option<String>,
    pub worktrees: Vec<WorktreeDto>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionDto {
    pub id: String,
    pub project_id: String,
    pub worktree_id: String,
    pub title: Option<String>,
    pub status: String,
    #[specta(type = specta_typescript::Number)]
    pub version: i64,
    pub has_summary: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_active_at: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageDto {
    pub id: String,
    pub session_id: String,
    pub role: String,
    #[specta(type = specta_typescript::Number)]
    pub position: i64,
    pub content: String,
    pub provider_run_id: Option<String>,
    pub created_at: String,
    pub parts: Vec<PartDto>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PartDto {
    pub id: String,
    pub message_id: String,
    pub r#type: String,
    pub content: String,
    #[specta(type = specta_typescript::Number)]
    pub position: i64,
    pub provider_run_id: Option<String>,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PinnedContextDto {
    pub id: String,
    pub r#type: String,
    pub source: String,
    pub resolved_path: Option<String>,
    pub content: String,
    pub metadata: Option<String>,
    pub pinned_at: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRunDto {
    pub id: String,
    pub adapter_type: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    #[specta(type = specta_typescript::Number)]
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub path: String,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    pub worktree_id: String,
    pub first_session_under_worktree: bool,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTitleRequest {
    pub title: String,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SubmitMessageRequest {
    pub content: String,
    pub mentions: Option<Vec<MentionInput>>,
    pub slash_command: Option<SlashCommandInput>,
}

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MentionInput {
    pub r#type: String,
    pub r#ref: String,
}

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandInput {
    pub command: String,
    pub argument: Option<String>,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeRequest {
    pub branch: String,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RenameWorktreeBranchRequest {
    pub new_branch: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectResponse {
    pub id: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    pub session: SessionDto,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionResponse {
    pub session: SessionDto,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionViewResponse {
    pub session: SessionDto,
    pub messages: Vec<MessageDto>,
    pub pinned_context: Vec<PinnedContextDto>,
    pub has_summary: bool,
    pub provider_runs: Vec<ProviderRunDto>,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryResponse {
    pub suggestions: Vec<String>,
    pub exists: bool,
}

impl From<&SessionMetadata> for SessionSummaryDto {
    fn from(s: &SessionMetadata) -> Self {
        Self {
            id: s.id.clone(),
            title: s.title.clone(),
            status: s.status.clone(),
            created_at: format_iso8601(s.created_at),
            updated_at: format_iso8601(s.updated_at),
            last_active_at: format_iso8601(s.last_active_at),
        }
    }
}

impl From<DbSession> for SessionDto {
    fn from(s: DbSession) -> Self {
        Self {
            id: s.id,
            project_id: s.project_id,
            worktree_id: s.worktree_id,
            title: s.title,
            status: s.status,
            version: s.version,
            has_summary: s.has_summary,
            created_at: format_iso8601(s.created_at),
            updated_at: format_iso8601(s.updated_at),
            last_active_at: format_iso8601(s.last_active_at),
        }
    }
}
