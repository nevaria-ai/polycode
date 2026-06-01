use crate::api::sessions::model::{CreateSession, Session};
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
        let id = uuid::Uuid::new_v4().to_string();
        let now = unix_now();
        self.db
            .workspace_one(
                "CreateSession",
                &serde_json::json!({
                    "id": id,
                    "project_id": input.project_id,
                    "worktree_id": input.worktree_id,
                    "worktree_path": input.worktree_path,
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
    use crate::test_support::memory_db;

    #[tokio::test]
    async fn create_session() {
        let svc = Service::new(memory_db());
        let session = svc
            .create(CreateSession {
                project_id: "proj-1".into(),
                worktree_path: "/tmp/worktree".into(),
                worktree_id: Some("wt-1".into()),
                title: None,
            })
            .await
            .unwrap();

        assert!(!session.id.is_empty());
        assert_eq!(session.project_id, "proj-1");
        assert_eq!(session.worktree_id, Some("wt-1".to_string()));
        assert_eq!(session.worktree_path, "/tmp/worktree");
        assert_eq!(session.status, "active");
        assert_eq!(session.version, 1);
        assert_eq!(session.has_summary, 0);
        assert!(session.title.is_none());
    }

    #[tokio::test]
    async fn list_by_project() {
        let svc = Service::new(memory_db());

        for path in ["/tmp/a1", "/tmp/a2", "/tmp/b1"] {
            let project_id = if path == "/tmp/b1" {
                "proj-b"
            } else {
                "proj-a"
            };
            svc.create(CreateSession {
                project_id: project_id.into(),
                worktree_path: path.into(),
                worktree_id: None,
                title: None,
            })
            .await
            .unwrap();
        }

        let sessions = svc.list_by_project("proj-a").await.unwrap();
        assert_eq!(sessions.len(), 2);
        assert!(sessions.iter().all(|s| s.project_id == "proj-a"));
    }

    #[tokio::test]
    async fn archive_session() {
        let svc = Service::new(memory_db());
        let created = svc
            .create(CreateSession {
                project_id: "proj-1".into(),
                worktree_path: "/tmp/path".into(),
                worktree_id: None,
                title: None,
            })
            .await
            .unwrap();
        assert_eq!(created.status, "active");
        let archived = svc.archive(&created.id).await.unwrap();
        assert_eq!(archived.status, "archived");
    }
}
