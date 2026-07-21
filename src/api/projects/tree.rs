use std::collections::HashMap;
use std::path::Path;

use crate::api::projects::model::Project;
use crate::api::sessions::{Service as SessionService, SessionMetadata};
use crate::api::types::*;
use crate::api::worktrees::Service as WorktreeService;
use crate::db::DbHandle;
use crate::error::AppError;
use crate::git::worktree::{GitOps, WorktreeInfo};

pub struct ProjectTreeBuilder {
    db: DbHandle,
}

impl ProjectTreeBuilder {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub async fn build_all(
        &self,
        projects: Vec<Project>,
        labels: &HashMap<String, (String, Option<String>)>,
        display_names: &HashMap<String, String>,
    ) -> Result<Vec<ApiProjectTree>, AppError> {
        let all_sessions = SessionService::new(self.db.clone()).list_metadata().await?;
        let mut sessions_by_project: HashMap<String, Vec<SessionMetadata>> = HashMap::new();
        for session in all_sessions {
            sessions_by_project
                .entry(session.project_id.clone())
                .or_default()
                .push(session);
        }

        let mut trees = Vec::with_capacity(projects.len());
        for project in projects {
            let sessions = sessions_by_project.remove(&project.id).unwrap_or_default();
            trees.push(
                self.build_one(project, labels, display_names, &sessions)
                    .await?,
            );
        }
        Ok(trees)
    }

    pub async fn build_one(
        &self,
        project: Project,
        labels: &HashMap<String, (String, Option<String>)>,
        display_names: &HashMap<String, String>,
        sessions: &[SessionMetadata],
    ) -> Result<ApiProjectTree, AppError> {
        let (label, owner) = labels.get(&project.id).cloned().unwrap_or_default();
        let display_name = display_names.get(&project.id).cloned().unwrap_or(label);

        let git_worktrees = list_git_worktrees(&project.path);
        let path_to_id: HashMap<String, String> = git_worktrees
            .iter()
            .map(|wt| {
                (
                    wt.path.clone(),
                    WorktreeService::worktree_id_for_path(&wt.path, &project.id),
                )
            })
            .collect();

        let mut sessions_by_worktree: HashMap<String, Vec<ApiSessionMetadata>> = HashMap::new();
        for session in sessions {
            let wt_id = resolve_session_worktree_id(session, &project.id, &path_to_id);
            sessions_by_worktree
                .entry(wt_id)
                .or_default()
                .push(ApiSessionMetadata::from(session));
        }

        for list in sessions_by_worktree.values_mut() {
            list.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));
        }

        let worktrees = git_worktrees
            .into_iter()
            .map(|wt| {
                let id = WorktreeService::worktree_id_for_path(&wt.path, &project.id);
                ApiWorktreeWithSessions {
                    id: id.clone(),
                    branch: wt.branch,
                    is_linked_worktree: wt.is_linked_worktree,
                    sessions: sessions_by_worktree.remove(&id).unwrap_or_default(),
                }
            })
            .collect();

        Ok(ApiProjectTree {
            id: project.id,
            path: project.path,
            expanded_state: project.expanded_state,
            created_at: format_iso8601(project.created_at),
            display_name,
            owner,
            worktrees,
        })
    }
}

fn list_git_worktrees(project_path: &str) -> Vec<WorktreeInfo> {
    GitOps::list_worktrees(Path::new(project_path)).unwrap_or_else(|_| {
        vec![WorktreeInfo {
            path: project_path.to_string(),
            is_linked_worktree: false,
            branch: None,
        }]
    })
}

fn resolve_session_worktree_id(
    session: &SessionMetadata,
    project_id: &str,
    path_to_id: &HashMap<String, String>,
) -> String {
    if let Some(ref wt_id) = session.worktree_id {
        if !wt_id.is_empty() {
            return wt_id.clone();
        }
    }
    path_to_id
        .get(&session.worktree_path)
        .cloned()
        .unwrap_or_else(|| {
            WorktreeService::worktree_id_for_path(&session.worktree_path, project_id)
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::projects::model::Project;
    use crate::test_support::memory_db;

    fn session(
        id: &str,
        project_id: &str,
        worktree_id: Option<&str>,
        worktree_path: &str,
        title: Option<&str>,
    ) -> SessionMetadata {
        SessionMetadata {
            id: id.to_string(),
            project_id: project_id.to_string(),
            worktree_id: worktree_id.map(str::to_string),
            worktree_path: worktree_path.to_string(),
            title: title.map(str::to_string),
            status: "active".to_string(),
            created_at: 1,
            updated_at: 2,
            last_active_at: 10,
        }
    }

    #[tokio::test]
    async fn sessions_attach_to_worktree_not_project_root() {
        let db = memory_db();
        let project = Project {
            id: "p1".to_string(),
            path: "/tmp/not-git".to_string(),
            expanded_state: false,
            created_at: 0,
            removed_at: None,
        };
        let main_id = WorktreeService::worktree_id_for_path("/tmp/not-git", "p1");
        let sessions = vec![session(
            "s1",
            "p1",
            Some(&main_id),
            "/tmp/not-git",
            Some("Main session"),
        )];

        let labels = HashMap::from([("p1".to_string(), ("not-git".to_string(), None))]);
        let display_names = HashMap::from([("p1".to_string(), "not-git".to_string())]);

        let tree = ProjectTreeBuilder::new(db)
            .build_one(project, &labels, &display_names, &sessions)
            .await
            .unwrap();

        assert!(tree.worktrees.len() == 1);
        assert!(!tree.worktrees[0].is_linked_worktree);
        assert_eq!(tree.worktrees[0].sessions.len(), 1);
        assert_eq!(
            tree.worktrees[0].sessions[0].title.as_deref(),
            Some("Main session")
        );
    }

    #[tokio::test]
    async fn legacy_null_worktree_id_matches_path() {
        let db = memory_db();
        let project = Project {
            id: "p1".to_string(),
            path: "/tmp/legacy".to_string(),
            expanded_state: false,
            created_at: 0,
            removed_at: None,
        };
        let sessions = vec![session("s1", "p1", None, "/tmp/legacy", None)];
        let labels = HashMap::from([("p1".to_string(), ("legacy".to_string(), None))]);
        let display_names = HashMap::from([("p1".to_string(), "legacy".to_string())]);

        let tree = ProjectTreeBuilder::new(db)
            .build_one(project, &labels, &display_names, &sessions)
            .await
            .unwrap();

        assert_eq!(tree.worktrees[0].sessions.len(), 1);
        assert_eq!(tree.worktrees[0].sessions[0].id, "s1");
    }
}
