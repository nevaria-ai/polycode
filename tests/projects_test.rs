//! Project feature integration tests (Service + git, no HTTP).

mod common;

use esk_code::features::projects::{CreateProject, Service as ProjectService};

#[tokio::test]
async fn create_normalizes_linked_worktree_path_to_main_repo() {
    let db = common::memory_db();
    let (dir, project_id, main_path) = common::setup_git_project(db.clone()).await;

    let linked = dir.path().join("linked-wt");
    common::git_worktree_add(&main_path, &linked, "linked-branch");

    let projects = ProjectService::new(db.clone());
    let again = projects
        .create(CreateProject {
            path: linked.to_string_lossy().to_string(),
        })
        .await
        .expect("create via linked path");
    assert_eq!(again.id, project_id);

    let listed = projects.list().await.expect("list");
    let project = listed.iter().find(|p| p.id == project_id).expect("project");
    assert_eq!(project.path, main_path);
}

#[tokio::test]
async fn list_trees_nests_sessions_under_git_main_worktree() {
    let db = common::memory_db();
    let (_dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let main_worktree_id = common::v5_id_for_path(&project_path);

    let session = common::create_session(
        db.clone(),
        &project_id,
        &project_path,
        &main_worktree_id,
        true,
    )
    .await;

    let trees = ProjectService::new(db)
        .list_trees()
        .await
        .expect("list_trees");
    assert_eq!(trees.len(), 1);
    let project = &trees[0];
    assert_eq!(project.id, project_id);

    let main = project
        .worktrees
        .iter()
        .find(|wt| !wt.is_linked_worktree)
        .expect("unlinked main worktree");
    assert_eq!(main.id, main_worktree_id);
    assert_eq!(main.branch.as_deref(), Some("main"));
    assert_eq!(main.sessions.len(), 1);
    assert_eq!(main.sessions[0].id, session.id);
}
