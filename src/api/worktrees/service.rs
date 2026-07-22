use std::path::Path;

use crate::api::worktrees::model::WorktreeRow;
use crate::db::DbHandle;
use crate::error::AppError;
use crate::git::worktree::{GitOps, WorktreeInfo};
use crate::paths;
use crate::utils::unix_now;

#[derive(Clone)]
pub struct Service {
    db: DbHandle,
}

impl Service {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    /// Stable id for a worktree path before a DB row exists.
    ///
    /// App-managed paths use the UUID folder name under `.../worktrees/<uuid>/` so branch renames
    /// (the only user-visible "rename") never require id or path changes. External git worktrees
    /// use UUID v5(NAMESPACE_URL, path). Non-UUID folder names under the managed root fall back to
    /// v5(path) so corrupt or legacy layouts still get a deterministic id.
    pub fn worktree_id_for_path(path: &str, project_id: &str) -> String {
        let managed_root = paths::project_dir(project_id).join("worktrees");
        let path_obj = Path::new(path);
        if path_obj.starts_with(&managed_root) {
            if let Some(id) = path_obj.file_name().and_then(|s| s.to_str()) {
                if uuid::Uuid::parse_str(id).is_ok() {
                    return id.to_string();
                }
            }
        }
        uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_URL, path.as_bytes()).to_string()
    }

    /// App-managed checkout path when `worktree_id` is a v4 UUID folder name under
    /// `~/.polycode/projects/<project_id>/worktrees/`. Avoids DB lookup and git scan.
    pub fn managed_path_for_id(project_id: &str, worktree_id: &str) -> Option<String> {
        let parsed = uuid::Uuid::parse_str(worktree_id).ok()?;
        if parsed.get_version() != Some(uuid::Version::Random) {
            return None;
        }
        Some(
            paths::worktree_dir(project_id, worktree_id)
                .to_string_lossy()
                .into_owned(),
        )
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<WorktreeRow>, AppError> {
        self.db
            .workspace_optional("FindWorktreeById", &serde_json::json!({ "id": id }))
            .map_err(AppError::from)
    }

    pub async fn list_by_project(&self, project_id: &str) -> Result<Vec<WorktreeRow>, AppError> {
        self.db
            .workspace_many(
                "ListWorktreesByProject",
                &serde_json::json!({ "project_id": project_id }),
            )
            .map_err(AppError::from)
    }

    pub async fn update_expanded_state(&self, id: &str, expanded: bool) -> Result<(), AppError> {
        self.db
            .workspace(
                "UpdateWorktreeExpandedState",
                &serde_json::json!({
                    "id": id,
                    "expanded_state": i64::from(expanded),
                }),
            )
            .map_err(AppError::from)?;
        Ok(())
    }

    fn git_worktrees(project_path: &str) -> Vec<WorktreeInfo> {
        GitOps::list_worktrees(Path::new(project_path)).unwrap_or_else(|_| {
            vec![WorktreeInfo {
                path: project_path.to_string(),
                is_linked_worktree: false,
                branch: None,
            }]
        })
    }

    fn git_entry_for_id<'a>(
        _project_path: &str,
        project_id: &str,
        worktree_id: &str,
        git_worktrees: &'a [WorktreeInfo],
    ) -> Option<&'a WorktreeInfo> {
        git_worktrees
            .iter()
            .find(|wt| Self::worktree_id_for_path(&wt.path, project_id) == worktree_id)
    }

    /// Git scan to resolve an external worktree path from its stable v5 id.
    fn external_path_for_id(
        project_id: &str,
        project_path: &str,
        worktree_id: &str,
    ) -> Result<String, AppError> {
        let git_worktrees = Self::git_worktrees(project_path);
        if let Some(wt) =
            Self::git_entry_for_id(project_path, project_id, worktree_id, &git_worktrees)
        {
            return Ok(wt.path.clone());
        }

        let default_id = Self::worktree_id_for_path(project_path, project_id);
        if worktree_id == default_id {
            return Ok(project_path.to_string());
        }

        Err(AppError::NotFound("worktree not found".into()))
    }

    fn is_linked_for_id(project_path: &str, project_id: &str, worktree_id: &str) -> bool {
        let git_worktrees = Self::git_worktrees(project_path);
        Self::git_entry_for_id(project_path, project_id, worktree_id, &git_worktrees)
            .map(|wt| wt.is_linked_worktree)
            .unwrap_or(false)
    }

    /// Map a stable worktree id to its checkout path (DB row, managed convention, or git scan).
    pub async fn path_for_id(
        &self,
        project_id: &str,
        project_path: &str,
        worktree_id: &str,
    ) -> Result<String, AppError> {
        if let Some(path) = Self::managed_path_for_id(project_id, worktree_id) {
            return Ok(path);
        }

        if let Some(row) = self.find_by_id(worktree_id).await? {
            return Ok(row.path);
        }

        Self::external_path_for_id(project_id, project_path, worktree_id)
    }

    /// Branch checked out in the worktree identified by `worktree_id`.
    /// Composes `path_for_id` (DB/managed/git scan) with `get_worktree_branch` (HEAD read).
    pub async fn branch_name_for_id(
        &self,
        project_id: &str,
        project_path: &str,
        worktree_id: &str,
    ) -> Result<Option<String>, AppError> {
        let path = self
            .path_for_id(project_id, project_path, worktree_id)
            .await?;
        if !Path::new(&path).exists() {
            return Ok(None);
        }
        GitOps::get_worktree_branch(Path::new(&path)).map_err(AppError::BadRequest)
    }

    pub async fn add_row(
        &self,
        project_id: &str,
        id: &str,
        path: &str,
        is_linked_worktree: bool,
    ) -> Result<WorktreeRow, AppError> {
        let now = unix_now();
        self.db
            .workspace_one(
                "AddWorktree",
                &serde_json::json!({
                    "id": id,
                    "project_id": project_id,
                    "path": path,
                    "is_linked_worktree": i64::from(is_linked_worktree),
                    "expanded_state": 0,
                    "created_at": now,
                }),
            )
            .map_err(AppError::from)
    }

    /// Lazy worktree row on first session or expand toggle: app-managed ids use the `.polycode`
    /// path convention; external ids git-scan once (or use project path for non-git), then
    /// `AddWorktree`.
    pub async fn ensure_row_for_id(
        &self,
        project_id: &str,
        project_path: &str,
        worktree_id: &str,
    ) -> Result<WorktreeRow, AppError> {
        if let Some(row) = self.find_by_id(worktree_id).await? {
            return Ok(row);
        }

        let path = if let Some(path) = Self::managed_path_for_id(project_id, worktree_id) {
            path
        } else {
            Self::external_path_for_id(project_id, project_path, worktree_id)?
        };
        let is_linked_worktree = Self::is_linked_for_id(project_path, project_id, worktree_id);

        self.add_row(project_id, worktree_id, &path, is_linked_worktree)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worktree_id_external_path_is_stable_v5() {
        let path = "/tmp/external-wt";
        let id = Service::worktree_id_for_path(path, "proj-1");
        let expected = uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_URL, path.as_bytes()).to_string();
        assert_eq!(id, expected);
        assert_eq!(
            uuid::Uuid::parse_str(&id).unwrap().get_version(),
            Some(uuid::Version::Sha1)
        );
    }

    #[test]
    fn worktree_id_managed_path_uses_folder_uuid() {
        let wt_uuid = "550e8400-e29b-41d4-a716-446655440000";
        let path = paths::worktree_dir("proj-1", wt_uuid);
        let id = Service::worktree_id_for_path(path.to_str().unwrap(), "proj-1");
        assert_eq!(id, wt_uuid);
        assert_eq!(
            uuid::Uuid::parse_str(&id).unwrap().get_version(),
            Some(uuid::Version::Random)
        );
    }

    #[test]
    fn worktree_id_same_path_is_deterministic() {
        let a = Service::worktree_id_for_path("/repo/wt", "p1");
        let b = Service::worktree_id_for_path("/repo/wt", "p2");
        assert_eq!(a, b, "v5(path) ignores project_id for external paths");
    }

    #[test]
    fn managed_path_for_id_returns_polycode_worktree_dir() {
        let wt_uuid = "550e8400-e29b-41d4-a716-446655440000";
        let path = Service::managed_path_for_id("proj-1", wt_uuid).unwrap();
        assert_eq!(
            path,
            paths::worktree_dir("proj-1", wt_uuid).to_string_lossy()
        );
    }

    #[test]
    fn managed_path_for_id_rejects_v5_external_id() {
        let v5_id = uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_URL, b"/external").to_string();
        assert!(Service::managed_path_for_id("proj-1", &v5_id).is_none());
    }

    #[test]
    fn external_path_for_non_git_project_uses_project_path() {
        let path = Service::external_path_for_id(
            "p1",
            "/tmp/not-git",
            &Service::worktree_id_for_path("/tmp/not-git", "p1"),
        )
        .unwrap();
        assert_eq!(path, "/tmp/not-git");
    }
}
