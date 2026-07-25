//! Worktree feature integration tests (Service + git + DB composition).

mod common;

use esk_code::features::projects::Service as ProjectService;
use esk_code::features::sessions::Service as SessionService;
use esk_code::features::worktrees::Service as WorktreeService;
use uuid::Uuid;

#[tokio::test]
async fn list_trees_shows_stable_v5_main_worktree_id() {
    let db = common::memory_db();
    let (_dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let expected_id = common::v5_id_for_path(&project_path);

    let projects = ProjectService::new(db);
    let first = projects.list_trees().await.expect("list_trees");
    let wt = &first[0].worktrees;
    assert_eq!(wt.len(), 1);
    assert!(!wt[0].is_linked_worktree);
    assert_eq!(wt[0].branch.as_deref(), Some("main"));
    assert_eq!(wt[0].id, expected_id);

    let second = projects.list_trees().await.expect("list_trees again");
    assert_eq!(second[0].worktrees[0].id, expected_id);
    assert_eq!(second[0].id, project_id);
}

#[tokio::test]
async fn create_managed_worktree_persists_v4_folder_id() {
    let db = common::memory_db();
    let (_dir, project_id, _path) = common::setup_git_project(db.clone()).await;
    let worktrees = WorktreeService::new(db.clone());

    let id = worktrees
        .create(&project_id, "feature-a")
        .await
        .expect("create worktree");
    let parsed = Uuid::parse_str(&id).expect("valid uuid");
    assert_eq!(parsed.get_version(), Some(uuid::Version::Random));

    let created_path = esk_code::paths::worktree_dir(&project_id, &id);
    assert_eq!(
        id,
        WorktreeService::worktree_id_for_path(created_path.to_str().unwrap(), &project_id)
    );

    let projects = ProjectService::new(db);
    let trees = projects.list_trees().await.expect("list_trees");
    let linked = trees[0]
        .worktrees
        .iter()
        .find(|w| w.branch.as_deref() == Some("feature-a"))
        .expect("linked worktree");
    assert!(linked.is_linked_worktree);
    assert_eq!(linked.id, id);

    let trees_again = projects.list_trees().await.expect("list_trees again");
    let linked_again = trees_again[0]
        .worktrees
        .iter()
        .find(|w| w.id == id)
        .expect("stable id on second list");
    assert_eq!(linked_again.id, id);
}

#[tokio::test]
async fn session_lazy_creates_row_for_external_git_worktree() {
    let db = common::memory_db();
    let (dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let ext_path = dir.path().join("external-wt");
    common::git_worktree_add(&project_path, &ext_path, "external-branch");

    let ext_path_str = ext_path.to_str().unwrap();
    let list_id = common::v5_id_for_path(ext_path_str);
    assert_eq!(
        Uuid::parse_str(&list_id).unwrap().get_version(),
        Some(uuid::Version::Sha1)
    );

    let trees = ProjectService::new(db.clone())
        .list_trees()
        .await
        .expect("list_trees");
    assert!(
        trees[0]
            .worktrees
            .iter()
            .any(|w| w.id == list_id),
        "external worktree visible in tree before DB row"
    );

    let session1 = common::create_session(db.clone(), &project_id, &project_path, &list_id, true)
        .await;
    assert_eq!(session1.worktree_id, list_id);

    let row = WorktreeService::new(db.clone())
        .find_by_id(&list_id)
        .await
        .expect("find")
        .expect("lazy worktree row");
    assert_eq!(row.id, list_id);
    assert_eq!(row.path, ext_path_str);

    let session2 = common::create_session(db, &project_id, &project_path, &list_id, false).await;
    assert_eq!(session2.worktree_id, list_id);
}

#[tokio::test]
async fn delete_checkout_keeps_session_and_stable_worktree_id() {
    let db = common::memory_db();
    let (dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let ext_path = dir.path().join("api-delete-wt");
    common::git_worktree_add(&project_path, &ext_path, "api-delete-branch");

    let expected_id = common::v5_id_for_path(ext_path.to_str().unwrap());
    let session = common::create_session(
        db.clone(),
        &project_id,
        &project_path,
        &expected_id,
        true,
    )
    .await;
    assert_eq!(session.worktree_id, expected_id);

    WorktreeService::new(db.clone())
        .delete_checkout(&project_id, &expected_id)
        .await
        .expect("delete_checkout");

    let trees = ProjectService::new(db.clone())
        .list_trees()
        .await
        .expect("list_trees");
    assert!(trees[0]
        .worktrees
        .iter()
        .all(|w| w.id != expected_id));

    let sessions = SessionService::new(db.clone());
    let got = sessions.get(&session.id).await.expect("session remains");
    assert_eq!(got.worktree_id, expected_id);

    sessions
        .update_title(&session.id, "still writable")
        .await
        .expect("title update after checkout delete");
}

#[tokio::test]
async fn path_reuse_reattaches_new_session_to_immortal_row() {
    let db = common::memory_db();
    let (dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let ext_path = dir.path().join("reuse-wt");
    common::git_worktree_add(&project_path, &ext_path, "reuse-branch");

    let ext_path_str = ext_path.to_str().unwrap();
    let first_id = common::v5_id_for_path(ext_path_str);
    let session1 =
        common::create_session(db.clone(), &project_id, &project_path, &first_id, true).await;
    assert_eq!(session1.worktree_id, first_id);

    common::git_worktree_remove(&project_path, ext_path_str);
    common::git_worktree_add(&project_path, &ext_path, "reuse-branch-2");

    let session2 =
        common::create_session(db, &project_id, &project_path, &first_id, false).await;
    assert_eq!(session2.worktree_id, first_id);
}

#[tokio::test]
async fn delete_checkout_resolves_git_only_id_without_db_row() {
    let db = common::memory_db();
    let (dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let ext_path = dir.path().join("git-only-wt");
    common::git_worktree_add(&project_path, &ext_path, "git-only-branch");

    let worktree_id = common::v5_id_for_path(ext_path.to_str().unwrap());
    WorktreeService::new(db.clone())
        .delete_checkout(&project_id, &worktree_id)
        .await
        .expect("delete git-only worktree by stable id");

    let trees = ProjectService::new(db)
        .list_trees()
        .await
        .expect("list_trees");
    assert_eq!(trees[0].worktrees.len(), 1);
    assert!(!trees[0].worktrees[0].is_linked_worktree);
}

#[tokio::test]
async fn set_expanded_state_ensures_row_and_persists() {
    let db = common::memory_db();
    let (_dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let worktree_id = common::v5_id_for_path(&project_path);

    WorktreeService::new(db.clone())
        .set_expanded_state(&project_id, &worktree_id, true)
        .await
        .expect("set_expanded_state");

    let row = WorktreeService::new(db.clone())
        .find_by_id(&worktree_id)
        .await
        .expect("find")
        .expect("row created");
    assert!(row.expanded_state);

    let trees = ProjectService::new(db)
        .list_trees()
        .await
        .expect("list_trees");
    let main = trees[0]
        .worktrees
        .iter()
        .find(|w| w.id == worktree_id)
        .expect("main");
    assert!(main.expanded_state);
}

#[tokio::test]
async fn rename_checked_out_branch_keeps_id() {
    let db = common::memory_db();
    let (_dir, project_id, _path) = common::setup_git_project(db.clone()).await;
    let worktrees = WorktreeService::new(db.clone());
    let wt_id = worktrees
        .create(&project_id, "feature-a")
        .await
        .expect("create");

    worktrees
        .rename_checked_out_branch(&project_id, &wt_id, "feature-renamed")
        .await
        .expect("rename");

    let trees = ProjectService::new(db)
        .list_trees()
        .await
        .expect("list_trees");
    let wt = trees[0]
        .worktrees
        .iter()
        .find(|w| w.id == wt_id)
        .expect("same id after rename");
    assert_eq!(wt.branch.as_deref(), Some("feature-renamed"));
    assert!(wt.is_linked_worktree);
}

#[tokio::test]
async fn update_title_allowed_after_external_git_remove() {
    let db = common::memory_db();
    let (dir, project_id, project_path) = common::setup_git_project(db.clone()).await;
    let ext_path = dir.path().join("mutable-wt");
    common::git_worktree_add(&project_path, &ext_path, "mutable-branch");

    let worktree_id = common::v5_id_for_path(ext_path.to_str().unwrap());
    let session =
        common::create_session(db.clone(), &project_id, &project_path, &worktree_id, true).await;

    common::git_worktree_remove(&project_path, ext_path.to_str().unwrap());

    SessionService::new(db)
        .update_title(&session.id, "still writable")
        .await
        .expect("no archive guard when worktree gone from git");
}
