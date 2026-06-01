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
        let id = uuid::Uuid::new_v4().to_string();
        let now = unix_now();

        let resolved = GitOps::resolve_repo_root(Path::new(&input.path))
            .unwrap_or_else(|_| Path::new(&input.path).to_path_buf());
        let resolved_str = resolved.to_string_lossy().to_string();

        let name = GitOps::get_remote_origin_name(Path::new(&resolved_str)).unwrap_or_else(|| {
            Path::new(&resolved_str)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| resolved_str.clone())
        });

        self.db
            .workspace_one(
                "CreateProject",
                &serde_json::json!({
                    "id": id,
                    "name": name,
                    "path": resolved_str,
                    "expanded_state": 0,
                    "created_at": now,
                }),
            )
            .map_err(AppError::from)
    }

    pub async fn close(&self, id: &str) -> Result<(), AppError> {
        self.db
            .workspace("DeleteProject", &serde_json::json!({ "id": id }))
            .map_err(AppError::from)?;
        Ok(())
    }

    pub async fn update_expanded_state(
        &self,
        id: &str,
        expanded: bool,
    ) -> Result<Project, AppError> {
        self.db
            .workspace_one(
                "UpdateProjectExpandedState",
                &serde_json::json!({
                    "id": id,
                    "expanded_state": i64::from(expanded),
                }),
            )
            .map_err(AppError::from)
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
        assert_eq!(project.name, "my-project");
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
        assert_eq!(fetched.name, "fetch-me");
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
        let updated = svc.update_expanded_state(&created.id, true).await.unwrap();
        assert!(updated.expanded_state);
    }
}
