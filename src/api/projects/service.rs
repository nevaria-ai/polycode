use std::path::Path;

use crate::api::projects::model::{CreateProject, Project};
use crate::db::DbHandle;
use crate::error::AppError;
use crate::git::worktree::GitOps;
use crate::utils::unix_now;

#[derive(Clone)]
pub struct Service {
    db: DbHandle,
}

impl Service {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub async fn list(&self) -> Result<Vec<Project>, AppError> {
        self.db
            .workspace_many("ListProjects", &serde_json::json!({}))
            .map_err(AppError::from)
    }

    pub async fn get(&self, id: &str) -> Result<Project, AppError> {
        self.db
            .workspace_optional("GetProject", &serde_json::json!({ "id": id }))
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound(format!("project {} not found", id)))
    }

    pub async fn create(&self, input: CreateProject) -> Result<Project, AppError> {
        let resolved = GitOps::resolve_repo_root(Path::new(&input.path))
            .unwrap_or_else(|_| Path::new(&input.path).to_path_buf());
        let resolved_str = resolved.to_string_lossy().to_string();

        if let Some(existing) = self
            .db
            .workspace_optional::<Project>(
                "FindProjectByPath",
                &serde_json::json!({ "path": resolved_str }),
            )
            .map_err(AppError::from)?
        {
            if existing.removed_at.is_some() {
                return self
                    .db
                    .workspace_one(
                        "ReactivateProject",
                        &serde_json::json!({ "id": existing.id }),
                    )
                    .map_err(AppError::from);
            }
            return Ok(existing);
        }

        let id = uuid::Uuid::new_v4().to_string();
        let now = unix_now();

        self.db
            .workspace_one(
                "CreateProject",
                &serde_json::json!({
                    "id": id,
                    "path": resolved_str,
                    "expanded_state": 0,
                    "created_at": now,
                }),
            )
            .map_err(AppError::from)
    }

    pub async fn close(&self, id: &str) -> Result<(), AppError> {
        let count: i64 = self
            .db
            .workspace_one(
                "CountSessionsByProject",
                &serde_json::json!({ "project_id": id }),
            )
            .map_err(AppError::from)?;

        if count > 0 {
            let now = unix_now();
            self.db
                .workspace_one::<Project>(
                    "SoftRemoveProject",
                    &serde_json::json!({ "id": id, "removed_at": now }),
                )
                .map_err(AppError::from)?;
        } else {
            self.db
                .workspace("DeleteProject", &serde_json::json!({ "id": id }))
                .map_err(AppError::from)?;
        }
        Ok(())
    }

    pub async fn update_expanded_state(&self, id: &str, expanded: bool) -> Result<(), AppError> {
        self.db
            .workspace(
                "UpdateProjectExpandedState",
                &serde_json::json!({
                    "id": id,
                    "expanded_state": i64::from(expanded),
                }),
            )
            .map_err(AppError::from)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppError;
    use crate::test_support::memory_db;

    #[tokio::test]
    async fn create_project() {
        let svc = Service::new(memory_db());
        let project = svc
            .create(CreateProject {
                path: "/tmp/my-project".into(),
            })
            .await
            .unwrap();
        assert_eq!(project.path, "/tmp/my-project");
        assert!(!project.expanded_state);
        assert!(!project.id.is_empty());
    }

    #[tokio::test]
    async fn list_projects() {
        let svc = Service::new(memory_db());
        svc.create(CreateProject {
            path: "/tmp/alpha".into(),
        })
        .await
        .unwrap();
        svc.create(CreateProject {
            path: "/tmp/beta".into(),
        })
        .await
        .unwrap();
        assert_eq!(svc.list().await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn get_project() {
        let svc = Service::new(memory_db());
        let created = svc
            .create(CreateProject {
                path: "/tmp/fetch-me".into(),
            })
            .await
            .unwrap();
        let fetched = svc.get(&created.id).await.unwrap();
        assert_eq!(fetched.path, "/tmp/fetch-me");
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn delete_project() {
        let svc = Service::new(memory_db());
        let created = svc
            .create(CreateProject {
                path: "/tmp/to-delete".into(),
            })
            .await
            .unwrap();
        svc.close(&created.id).await.unwrap();
        let err = svc.get(&created.id).await.unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[tokio::test]
    async fn list_order_by_created_at_desc() {
        let svc = Service::new(memory_db());
        let first = svc
            .create(CreateProject {
                path: "/tmp/first".into(),
            })
            .await
            .unwrap();
        let second = svc
            .create(CreateProject {
                path: "/tmp/second".into(),
            })
            .await
            .unwrap();
        let projects = svc.list().await.unwrap();
        assert_eq!(projects[0].id, second.id);
        assert_eq!(projects[1].id, first.id);
    }

    #[tokio::test]
    async fn update_expanded_state() {
        let svc = Service::new(memory_db());
        let created = svc
            .create(CreateProject {
                path: "/tmp/expanded".into(),
            })
            .await
            .unwrap();
        assert!(!created.expanded_state);
        svc.update_expanded_state(&created.id, true).await.unwrap();
        let updated = svc.get(&created.id).await.unwrap();
        assert!(updated.expanded_state);
    }

    #[tokio::test]
    async fn create_returns_existing_when_path_already_added() {
        let svc = Service::new(memory_db());
        let first = svc
            .create(CreateProject {
                path: "/tmp/duplicate-me".into(),
            })
            .await
            .unwrap();
        let second = svc
            .create(CreateProject {
                path: "/tmp/duplicate-me".into(),
            })
            .await
            .unwrap();
        assert_eq!(second.id, first.id);
        assert_eq!(svc.list().await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn create_allows_same_name_different_path() {
        let svc = Service::new(memory_db());
        let first = svc
            .create(CreateProject {
                path: "/tmp/alpha/repo".into(),
            })
            .await
            .unwrap();
        let second = svc
            .create(CreateProject {
                path: "/tmp/beta/repo".into(),
            })
            .await
            .unwrap();
        assert_ne!(second.id, first.id);
        assert_eq!(first.path, "/tmp/alpha/repo");
        assert_eq!(second.path, "/tmp/beta/repo");
        assert_eq!(svc.list().await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn close_soft_removes_when_sessions_exist() {
        let db = memory_db();
        let svc = Service::new(db.clone());
        let project = svc
            .create(CreateProject {
                path: "/tmp/with-sessions".into(),
            })
            .await
            .unwrap();
        db.workspace_one::<serde_json::Value>(
            "CreateSession",
            &serde_json::json!({
                "id": "sess-1",
                "project_id": project.id,
                "worktree_id": null,
                "worktree_path": "/tmp/with-sessions",
                "created_at": 1,
                "updated_at": 1,
                "last_active_at": 1,
            }),
        )
        .unwrap();

        svc.close(&project.id).await.unwrap();

        assert!(svc.list().await.unwrap().is_empty());
        let fetched = svc.get(&project.id).await.unwrap();
        assert!(fetched.removed_at.is_some());
    }

    #[tokio::test]
    async fn create_reactivates_soft_removed_project() {
        let db = memory_db();
        let svc = Service::new(db.clone());
        let project = svc
            .create(CreateProject {
                path: "/tmp/reactivate-me".into(),
            })
            .await
            .unwrap();
        db.workspace_one::<serde_json::Value>(
            "CreateSession",
            &serde_json::json!({
                "id": "sess-1",
                "project_id": project.id,
                "worktree_id": null,
                "worktree_path": "/tmp/reactivate-me",
                "created_at": 1,
                "updated_at": 1,
                "last_active_at": 1,
            }),
        )
        .unwrap();
        svc.close(&project.id).await.unwrap();
        assert!(svc.list().await.unwrap().is_empty());

        let reactivated = svc
            .create(CreateProject {
                path: "/tmp/reactivate-me".into(),
            })
            .await
            .unwrap();
        assert_eq!(reactivated.id, project.id);
        assert!(reactivated.removed_at.is_none());
        assert_eq!(svc.list().await.unwrap().len(), 1);
    }
}
