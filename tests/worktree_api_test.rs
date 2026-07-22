mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use std::process::Command;
use tower::ServiceExt;
use uuid::Uuid;

fn v5_id_for_path(path: &str) -> String {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, path.as_bytes()).to_string()
}

async fn setup_git_project() -> (axum::Router, tempfile::TempDir, String, String) {
    let app = common::app();
    let (dir, project_id, project_path) = common::setup_git_project(&app).await;
    (app, dir, project_id, project_path)
}

async fn list_worktrees_for_project(app: &axum::Router, project_id: &str) -> serde_json::Value {
    let resp = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let projects = common::json_body(resp).await;
    let project = projects
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"].as_str() == Some(project_id))
        .expect("project in nested tree");
    project["worktrees"].clone()
}

async fn create_session(
    app: &axum::Router,
    project_id: &str,
    worktree_id: &str,
    first_session_under_worktree: bool,
) -> serde_json::Value {
    let body = serde_json::json!({
        "worktreeId": worktree_id,
        "firstSessionUnderWorktree": first_session_under_worktree,
    });
    let resp = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{project_id}/sessions"),
            Some(body),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
    common::json_body(resp).await
}

async fn delete_worktree_api(
    app: &axum::Router,
    project_id: &str,
    worktree_id: &str,
) -> StatusCode {
    let encoded = urlencoding::encode(worktree_id);
    let resp = app
        .clone()
        .oneshot(common::json_request(
            "DELETE",
            &format!("/api/projects/{project_id}/worktrees/{encoded}"),
            None,
        ))
        .await
        .unwrap();
    resp.status()
}

async fn rename_branch_api(
    app: &axum::Router,
    project_id: &str,
    worktree_id: &str,
    new_branch: &str,
) -> StatusCode {
    let encoded = urlencoding::encode(worktree_id);
    let resp = app
        .clone()
        .oneshot(common::json_request(
            "PATCH",
            &format!("/api/projects/{project_id}/worktrees/{encoded}"),
            Some(serde_json::json!({
                "newBranch": new_branch,
            })),
        ))
        .await
        .unwrap();
    resp.status()
}

async fn create_worktree_api(app: &axum::Router, project_id: &str, branch: &str) -> String {
    let resp = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{project_id}/worktrees/create"),
            Some(serde_json::json!({ "branch": branch })),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    let listed = list_worktrees_for_project(app, project_id).await;
    listed
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["branch"].as_str() == Some(branch))
        .expect("created worktree in nested projects tree")["id"]
        .as_str()
        .unwrap()
        .to_string()
}

async fn update_session_title(
    app: &axum::Router,
    project_id: &str,
    session_id: &str,
    title: &str,
) -> StatusCode {
    let resp = app
        .clone()
        .oneshot(common::json_request(
            "PATCH",
            &format!("/api/projects/{project_id}/sessions/{session_id}/title"),
            Some(serde_json::json!({ "title": title })),
        ))
        .await
        .unwrap();
    resp.status()
}

#[tokio::test]
async fn test_list_worktrees_route_removed() {
    let app = common::app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/projects/00000000-0000-0000-0000-000000000000/worktrees")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_nested_projects_returns_git_worktree_entries() {
    let (app, _dir, project_id, project_path) = setup_git_project().await;
    let worktrees = list_worktrees_for_project(&app, &project_id).await;
    let arr = worktrees.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert!(!arr[0]["isLinkedWorktree"].as_bool().unwrap());
    assert_eq!(arr[0]["branch"].as_str(), Some("main"));
    assert!(arr[0].get("active").is_none());
    assert!(arr[0].get("lastSyncedAt").is_none());
    assert!(arr[0].get("path").is_none());

    let expected_id = v5_id_for_path(&project_path);
    assert_eq!(arr[0]["id"].as_str().unwrap(), expected_id);

    // List is read-only: no DB row yet, but id is stable v5(path) per response.
    let listed_again = list_worktrees_for_project(&app, &project_id).await;
    assert_eq!(
        listed_again.as_array().unwrap()[0]["id"].as_str().unwrap(),
        expected_id
    );

    let session = create_session(&app, &project_id, &expected_id, true).await;
    let persisted_id = session["session"]["worktreeId"]
        .as_str()
        .expect("session has worktreeId after lazy create");
    assert_eq!(persisted_id, expected_id);

    let listed_after = list_worktrees_for_project(&app, &project_id).await;
    let wt = listed_after
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"].as_str() == Some(expected_id.as_str()))
        .expect("unlinked worktree in list");
    assert_eq!(wt["id"].as_str().unwrap(), persisted_id);

    let listed_once_more = list_worktrees_for_project(&app, &project_id).await;
    let wt2 = listed_once_more
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"].as_str() == Some(expected_id.as_str()))
        .unwrap();
    assert_eq!(wt2["id"].as_str().unwrap(), persisted_id);
}

#[tokio::test]
async fn test_create_worktree_persists_uuid_v4_id() {
    let (app, _dir, project_id, _path) = setup_git_project().await;

    let resp = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{project_id}/worktrees/create"),
            Some(serde_json::json!({"branch": "feature-a"})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    let listed = list_worktrees_for_project(&app, &project_id).await;
    let arr = listed.as_array().unwrap();
    assert_eq!(arr.len(), 2);
    let wt = arr
        .iter()
        .find(|w| w["branch"].as_str() == Some("feature-a"))
        .expect("created worktree in nested projects tree");
    assert!(wt["isLinkedWorktree"].as_bool().unwrap());
    let id = wt["id"].as_str().unwrap();
    let parsed = Uuid::parse_str(id).expect("valid uuid");
    assert_eq!(parsed.get_version(), Some(uuid::Version::Random));
    let created_path = polycode::paths::worktree_dir(&project_id, id);
    assert_eq!(
        id,
        polycode::api::worktrees::Service::worktree_id_for_path(
            created_path.to_str().unwrap(),
            &project_id
        )
    );

    let listed_again = list_worktrees_for_project(&app, &project_id).await;
    let wt2 = listed_again
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"] == id)
        .expect("stable id on second list");
    assert_eq!(wt2["id"].as_str().unwrap(), id);
}

#[tokio::test]
async fn test_session_creates_worktree_row_lazily() {
    let (app, dir, project_id, project_path) = setup_git_project().await;
    let ext_path = dir.path().join("external-wt");
    Command::new("git")
        .args([
            "worktree",
            "add",
            ext_path.to_str().unwrap(),
            "-b",
            "external-branch",
        ])
        .current_dir(&project_path)
        .output()
        .expect("git worktree add");

    let ext_path_str = ext_path.to_str().unwrap();
    let listed = list_worktrees_for_project(&app, &project_id).await;
    let list_id = listed
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"].as_str() == Some(&v5_id_for_path(ext_path_str)))
        .expect("external worktree in git list")["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(list_id, v5_id_for_path(ext_path_str));
    assert_eq!(
        Uuid::parse_str(&list_id).unwrap().get_version(),
        Some(uuid::Version::Sha1)
    );

    let session1 = create_session(&app, &project_id, &list_id, true).await;
    let wt_id = session1["session"]["worktreeId"]
        .as_str()
        .expect("lazy worktree row created");
    assert_eq!(
        wt_id, list_id,
        "session row uses same v5(path) id as nested projects tree"
    );

    let listed_after = list_worktrees_for_project(&app, &project_id).await;
    let ext = listed_after
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"].as_str() == Some(&list_id))
        .expect("external worktree in git list");
    assert_eq!(ext["id"].as_str().unwrap(), wt_id);

    let session2 = create_session(&app, &project_id, &list_id, false).await;
    assert_eq!(
        session2["session"]["worktreeId"].as_str().unwrap(),
        wt_id,
        "same path reuses existing worktree row"
    );
}

#[tokio::test]
async fn test_delete_worktree_api_keeps_session_and_stable_id() {
    let (app, dir, project_id, project_path) = setup_git_project().await;
    let ext_path = dir.path().join("api-delete-wt");
    Command::new("git")
        .args([
            "worktree",
            "add",
            ext_path.to_str().unwrap(),
            "-b",
            "api-delete-branch",
        ])
        .current_dir(&project_path)
        .output()
        .expect("git worktree add");

    let ext_path_str = ext_path.to_str().unwrap();
    let expected_id = v5_id_for_path(ext_path_str);

    let session = create_session(&app, &project_id, &expected_id, true).await;
    let session_id = session["session"]["id"].as_str().unwrap().to_string();
    assert_eq!(
        session["session"]["worktreeId"].as_str().unwrap(),
        expected_id
    );

    assert_eq!(
        delete_worktree_api(&app, &project_id, &expected_id).await,
        StatusCode::NO_CONTENT
    );

    // Git checkout is gone from the live tree…
    let listed_again = list_worktrees_for_project(&app, &project_id).await;
    assert!(listed_again
        .as_array()
        .unwrap()
        .iter()
        .all(|w| w["id"].as_str() != Some(expected_id.as_str())));

    // …but DB row + session remain (same as external `git worktree remove`).
    let get_resp = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{project_id}/sessions/{session_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_resp.status(), StatusCode::OK);
    let body = common::json_body(get_resp).await;
    assert_eq!(
        body["session"]["worktreeId"].as_str().unwrap(),
        expected_id,
        "worktree id stays stable after git-only delete"
    );

    assert_eq!(
        update_session_title(&app, &project_id, &session_id, "still writable").await,
        StatusCode::OK
    );
}

#[tokio::test]
async fn test_patch_worktree_expanded_state() {
    let (app, _dir, project_id, project_path) = setup_git_project().await;
    let worktree_id = v5_id_for_path(&project_path);

    let resp = app
        .clone()
        .oneshot(common::json_request(
            "PATCH",
            &format!("/api/projects/{project_id}/worktrees/{worktree_id}/expanded-state"),
            Some(serde_json::json!({ "expandedState": true })),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    let listed = list_worktrees_for_project(&app, &project_id).await;
    let unlinked = listed
        .as_array()
        .unwrap()
        .iter()
        .find(|w| !w["isLinkedWorktree"].as_bool().unwrap())
        .expect("unlinked worktree");
    assert_eq!(unlinked["id"].as_str().unwrap(), worktree_id);
    assert!(unlinked["expandedState"].as_bool().unwrap());

    let project_expand = app
        .clone()
        .oneshot(common::json_request(
            "PATCH",
            &format!("/api/projects/{project_id}/expanded-state"),
            Some(serde_json::json!({ "expandedState": true })),
        ))
        .await
        .unwrap();
    assert_eq!(project_expand.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_session_update_allowed_after_worktree_git_removed() {
    let (app, dir, project_id, project_path) = setup_git_project().await;
    let ext_path = dir.path().join("mutable-wt");
    Command::new("git")
        .args([
            "worktree",
            "add",
            ext_path.to_str().unwrap(),
            "-b",
            "mutable-branch",
        ])
        .current_dir(&project_path)
        .output()
        .expect("git worktree add");

    let ext_path_str = ext_path.to_str().unwrap();
    let worktree_id = v5_id_for_path(ext_path_str);
    let session = create_session(&app, &project_id, &worktree_id, true).await;
    let session_id = session["session"]["id"].as_str().unwrap().to_string();

    Command::new("git")
        .args(["worktree", "remove", ext_path_str, "--force"])
        .current_dir(&project_path)
        .output()
        .expect("git worktree remove");

    assert_eq!(
        update_session_title(&app, &project_id, &session_id, "still writable").await,
        StatusCode::OK,
        "no archive guard blocks session updates when worktree is gone from git"
    );
}

#[tokio::test]
async fn test_path_reuse_attaches_new_session_to_same_worktree_row() {
    let (app, dir, project_id, project_path) = setup_git_project().await;
    let ext_path = dir.path().join("reuse-wt");
    Command::new("git")
        .args([
            "worktree",
            "add",
            ext_path.to_str().unwrap(),
            "-b",
            "reuse-branch",
        ])
        .current_dir(&project_path)
        .output()
        .expect("git worktree add");

    let ext_path_str = ext_path.to_str().unwrap();
    let first_id = v5_id_for_path(ext_path_str);
    let session1 = create_session(&app, &project_id, &first_id, true).await;
    assert_eq!(
        session1["session"]["worktreeId"].as_str().unwrap(),
        first_id
    );

    Command::new("git")
        .args(["worktree", "remove", ext_path_str, "--force"])
        .current_dir(&project_path)
        .output()
        .expect("git worktree remove");

    Command::new("git")
        .args(["worktree", "add", ext_path_str, "-b", "reuse-branch-2"])
        .current_dir(&project_path)
        .output()
        .expect("git worktree re-add");

    let session2 = create_session(&app, &project_id, &first_id, false).await;
    assert_eq!(
        session2["session"]["worktreeId"].as_str().unwrap(),
        first_id,
        "path reuse reuses immortal worktree row"
    );
}

#[tokio::test]
async fn test_rename_checked_out_branch_by_worktree_id() {
    let (app, _dir, project_id, _path) = setup_git_project().await;
    let wt_id = create_worktree_api(&app, &project_id, "feature-a").await;

    assert_eq!(
        rename_branch_api(&app, &project_id, &wt_id, "feature-renamed").await,
        StatusCode::NO_CONTENT
    );

    let listed = list_worktrees_for_project(&app, &project_id).await;
    let wt = listed
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"].as_str() == Some(wt_id.as_str()))
        .expect("worktree still listed by same id");
    assert_eq!(wt["branch"].as_str(), Some("feature-renamed"));
    assert!(wt["isLinkedWorktree"].as_bool().unwrap());
}

#[tokio::test]
async fn test_delete_worktree_by_id_ref() {
    let (app, _dir, project_id, _path) = setup_git_project().await;
    let wt_id = create_worktree_api(&app, &project_id, "to-delete").await;

    assert_eq!(
        delete_worktree_api(&app, &project_id, &wt_id).await,
        StatusCode::NO_CONTENT
    );

    let listed = list_worktrees_for_project(&app, &project_id).await;
    assert!(listed
        .as_array()
        .unwrap()
        .iter()
        .all(|w| w["id"].as_str() != Some(wt_id.as_str())));
}

#[tokio::test]
async fn test_git_only_worktree_resolves_by_id() {
    let (app, dir, project_id, project_path) = setup_git_project().await;
    let ext_path = dir.path().join("git-only-wt");
    Command::new("git")
        .args([
            "worktree",
            "add",
            ext_path.to_str().unwrap(),
            "-b",
            "git-only-branch",
        ])
        .current_dir(&project_path)
        .output()
        .expect("git worktree add");

    let ext_path_str = ext_path.to_str().unwrap();
    let worktree_id = v5_id_for_path(ext_path_str);

    assert_eq!(
        delete_worktree_api(&app, &project_id, &worktree_id).await,
        StatusCode::NO_CONTENT,
        "git-only worktree resolves by stable id from git scan"
    );

    let listed = list_worktrees_for_project(&app, &project_id).await;
    assert_eq!(listed.as_array().unwrap().len(), 1);
}
