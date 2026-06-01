//! Shared fixtures for `#[cfg(test)]` unit tests (not part of the public API).

use crate::api::projects::{CreateProject, Service as ProjectService};
use crate::api::sessions::{CreateSession, Service as SessionService};
use crate::db::DbHandle;

pub fn memory_db() -> DbHandle {
    crate::db::init_memory().expect("open test database")
}

pub async fn seed_project(db: DbHandle) -> String {
    ProjectService::new(db)
        .create(CreateProject {
            path: "/tmp/test-project".into(),
        })
        .await
        .expect("seed project")
        .id
}

pub async fn seed_session(db: DbHandle, project_id: &str) -> String {
    SessionService::new(db)
        .create(CreateSession {
            project_id: project_id.to_string(),
            worktree_path: "/tmp/work".into(),
            worktree_id: None,
            title: None,
        })
        .await
        .expect("seed session")
        .id
}

pub async fn seed_project_and_session(db: DbHandle) -> (String, String) {
    let project_id = seed_project(db.clone()).await;
    let session_id = seed_session(db, &project_id).await;
    (project_id, session_id)
}
