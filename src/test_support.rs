//! Shared fixtures for `#[cfg(test)]` unit tests (not part of the public API).

use crate::db::DbHandle;
use crate::features::projects::{CreateProject, Service as ProjectService};
use crate::features::sessions::{CreateSession, Service as SessionService};
use crate::features::worktrees::Service as WorktreeService;

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
    let project_path = "/tmp/test-project";
    let wt_id = WorktreeService::worktree_id_for_path(project_path, project_id);
    WorktreeService::new(db.clone())
        .add_row(project_id, &wt_id, project_path, false)
        .await
        .expect("seed worktree row");
    SessionService::new(db)
        .create(CreateSession {
            project_id: project_id.to_string(),
            project_path: project_path.into(),
            worktree_id: wt_id,
            first_session_under_worktree: true,
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
