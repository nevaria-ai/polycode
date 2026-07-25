//! Command-layer smoke: list_projects via tauri::State (no HTTP, no GUI window).

use esk_code::db::DbHandle;
use esk_code::features::projects::{CreateProject, Service as ProjectService};
use tauri::Manager;

#[tokio::test]
async fn list_projects_command_round_trip() {
    let db: DbHandle = esk_code::db::init_memory().expect("db");
    let created = ProjectService::new(db.clone())
        .create(CreateProject {
            path: "/tmp/esk-code-list-projects-smoke".into(),
        })
        .await
        .expect("create project");

    let app = tauri::test::mock_app();
    app.manage(db);

    let trees = esk_code::commands::list_projects(app.state())
        .await
        .expect("list_projects command");

    assert_eq!(trees.len(), 1);
    assert_eq!(trees[0].id, created.id);
    assert_eq!(trees[0].path, "/tmp/esk-code-list-projects-smoke");
    // Non-git projects still expose a synthetic worktree for session nesting.
    assert_eq!(trees[0].worktrees.len(), 1);
    assert!(!trees[0].worktrees[0].is_linked_worktree);
}
