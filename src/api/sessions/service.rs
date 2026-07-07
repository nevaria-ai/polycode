use crate::api::sessions::model::{CreateSession, Session};
use crate::api::worktrees::Service as WorktreeService;
use crate::db::DbHandle;
use crate::error::AppError;
use crate::utils::unix_now;

#[derive(Clone)]
pub struct Service {
    db: DbHandle,
}

impl Service {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub async fn list_all(&self) -> Result<Vec<Session>, AppError> {
        self.db
            .workspace_many("ListAllSessions", &serde_json::json!({}))
            .map_err(AppError::from)
    }

    pub async fn list_by_project(&self, project_id: &str) -> Result<Vec<Session>, AppError> {
        self.db
            .workspace_many(
                "ListSessionsByProject",
                &serde_json::json!({ "project_id": project_id }),
            )
            .map_err(AppError::from)
    }

    pub async fn create(&self, input: CreateSession) -> Result<Session, AppError> {
        let worktree_id = input.worktree_id.clone();
        let worktree_path = if input.first_session_under_worktree {
            WorktreeService::new(self.db.clone())
                .ensure_row_for_id(&input.project_id, &input.project_path, &worktree_id, true)
                .await?
                .path
        } else {
            String::new()
        };

        let id = uuid::Uuid::new_v4().to_string();
        let now = unix_now();
        self.db
            .workspace_one(
                "CreateSession",
                &serde_json::json!({
                    "id": id,
                    "project_id": input.project_id,
                    "worktree_id": worktree_id,
                    "worktree_path": worktree_path,
                    "created_at": now,
                    "updated_at": now,
                    "last_active_at": now,
                }),
            )
            .map_err(AppError::from)
    }

    pub async fn get(&self, id: &str) -> Result<Session, AppError> {
        self.db
            .workspace_optional("GetSession", &serde_json::json!({ "id": id }))
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound(format!("session {} not found", id)))
    }

    pub async fn delete(&self, id: &str) -> Result<(), AppError> {
        self.db
            .workspace("DeleteSession", &serde_json::json!({ "id": id }))
            .map_err(AppError::from)?;
        Ok(())
    }

    pub async fn update_title(&self, id: &str, title: &str) -> Result<Session, AppError> {
        let now = unix_now();
        self.db
            .workspace(
                "UpdateSessionTitle",
                &serde_json::json!({
                    "id": id,
                    "title": title,
                    "updated_at": now,
                    "last_active_at": now,
                }),
            )
            .map_err(AppError::from)?;
        self.get(id).await
    }

    pub async fn archive(&self, id: &str) -> Result<Session, AppError> {
        let now = unix_now();
        self.db
            .workspace(
                "ArchiveSession",
                &serde_json::json!({
                    "id": id,
                    "updated_at": now,
                }),
            )
            .map_err(AppError::from)?;
        self.get(id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::projects::CreateProject;
    use crate::api::projects::Service as ProjectService;
    use crate::api::worktrees::Service as WorktreeService;
    use crate::test_support::memory_db;

    #[tokio::test]
    async fn create_session() {
        let db = memory_db();
        let project = ProjectService::new(db.clone())
            .create(CreateProject {
                path: "/tmp/project".into(),
            })
            .await
            .unwrap();
        let wt_id = WorktreeService::worktree_id_for_path("/tmp/wt", &project.id);
        WorktreeService::new(db.clone())
            .add_row(&project.id, &wt_id, "/tmp/wt", true)
            .await
            .unwrap();

        let session = Service::new(db)
            .create(CreateSession {
                project_id: project.id.clone(),
                project_path: "/tmp/project".into(),
                worktree_id: wt_id.clone(),
                first_session_under_worktree: true,
                title: None,
            })
            .await
            .unwrap();

        assert_eq!(session.worktree_id, Some(wt_id));
        assert_eq!(session.worktree_path, "/tmp/wt");
    }

    #[tokio::test]
    async fn list_by_project() {
        let db = memory_db();
        let project = ProjectService::new(db.clone())
            .create(CreateProject {
                path: "/tmp/p".into(),
            })
            .await
            .unwrap();
        let wt_id = WorktreeService::worktree_id_for_path("/tmp/path", &project.id);
        WorktreeService::new(db.clone())
            .add_row(&project.id, &wt_id, "/tmp/path", true)
            .await
            .unwrap();
        Service::new(db.clone())
            .create(CreateSession {
                project_id: project.id.clone(),
                project_path: "/tmp/p".into(),
                worktree_id: wt_id,
                first_session_under_worktree: true,
                title: None,
            })
            .await
            .unwrap();

        let sessions = Service::new(db).list_by_project(&project.id).await.unwrap();
        assert_eq!(sessions.len(), 1);
    }
}
