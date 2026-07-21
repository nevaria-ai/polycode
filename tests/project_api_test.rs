mod common;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn test_list_projects_empty() {
    let app = common::app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let projects: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert!(projects.is_empty());
}

#[tokio::test]
async fn test_create_project() {
    let app = common::app();
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/projects")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({"path": "/tmp/test-project"})).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let result: serde_json::Value = common::json_body(response).await;
    assert!(result["id"].as_str().is_some());
    assert!(result.get("project").is_none());
}

#[tokio::test]
async fn test_close_project() {
    let app = common::app();
    let project_id = common::seed_project(&app).await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/projects/{project_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let result: serde_json::Value = common::json_body(response).await;
    assert_eq!(result["ok"], true);
}

#[tokio::test]
async fn test_create_project_dedupes_same_path() {
    // Re-adding an existing resolved path returns the same project id rather
    // than inserting a duplicate row — the underlying fix for the Svelte
    // each_key_duplicate crash.
    let app = common::app();

    let first = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": "/tmp/dedupe-me"})),
        ))
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::OK);
    let first_id = common::json_body(first).await["id"]
        .as_str()
        .unwrap()
        .to_string();

    let second = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": "/tmp/dedupe-me"})),
        ))
        .await
        .unwrap();
    assert_eq!(second.status(), StatusCode::OK);
    let second_body = common::json_body(second).await;
    assert_eq!(second_body["id"].as_str().unwrap(), first_id);

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let projects: Vec<serde_json::Value> =
        common::json_body(list).await.as_array().unwrap().clone();
    assert_eq!(projects.len(), 1);
}

#[tokio::test]
async fn test_create_project_allows_same_name_different_path() {
    let app = common::app();

    let first = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": "/tmp/alpha/repo"})),
        ))
        .await
        .unwrap();
    let first_id = common::json_body(first).await["id"]
        .as_str()
        .unwrap()
        .to_string();

    let second = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": "/tmp/beta/repo"})),
        ))
        .await
        .unwrap();
    let second_id = common::json_body(second).await["id"]
        .as_str()
        .unwrap()
        .to_string();

    assert_ne!(first_id, second_id);
}

#[tokio::test]
async fn test_list_projects_display_name_unique_keeps_name() {
    let app = common::app();
    common::seed_project_with(&app, "/tmp/alpha").await;
    common::seed_project_with(&app, "/tmp/beta").await;

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = common::json_body(list).await;
    let projects = body.as_array().unwrap();

    // Unique names → displayName is the folder basename; `name` is not exposed.
    let display_names: std::collections::HashSet<&str> = projects
        .iter()
        .map(|p| p["displayName"].as_str().unwrap())
        .collect();
    assert!(display_names.contains("alpha"));
    assert!(display_names.contains("beta"));
    for p in projects {
        assert!(p.get("name").is_none());
    }
}

#[tokio::test]
async fn test_list_projects_display_name_collision_uses_parent_slash_folder() {
    let app = common::app();
    common::seed_project_with(&app, "/tmp/alpha/repo").await;
    common::seed_project_with(&app, "/tmp/beta/repo").await;

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = common::json_body(list).await;
    let projects = body.as_array().unwrap();

    let display_names: std::collections::HashSet<&str> = projects
        .iter()
        .map(|p| p["displayName"].as_str().unwrap())
        .collect();
    assert!(display_names.contains("alpha/repo"));
    assert!(display_names.contains("beta/repo"));
}

#[tokio::test]
async fn test_list_projects_display_name_double_collision_uses_absolute_path() {
    // Same name AND same parent/folder segment: /tmp/alpha/temp/temp and
    // /tmp/beta/temp/temp both reduce to displayName "temp/temp" at the first
    // fallback level. The second pass must promote both to their absolute path.
    let app = common::app();
    common::seed_project_with(&app, "/tmp/alpha/temp/temp").await;
    common::seed_project_with(&app, "/tmp/beta/temp/temp").await;

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = common::json_body(list).await;
    let projects = body.as_array().unwrap();

    let display_names: std::collections::HashSet<&str> = projects
        .iter()
        .map(|p| p["displayName"].as_str().unwrap())
        .collect();
    assert!(display_names.contains("/tmp/alpha/temp/temp"));
    assert!(display_names.contains("/tmp/beta/temp/temp"));
    // No project should be left with the ambiguous "temp/temp" display name.
    assert!(!display_names.contains("temp/temp"));
}

#[tokio::test]
async fn test_close_project_soft_removes_when_sessions_exist() {
    let app = common::app();
    let (_dir, project_id, project_path) = common::setup_git_project(&app).await;
    common::seed_session(
        &app,
        &project_id,
        &common::v5_id_for_path(&project_path),
        true,
    )
    .await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/projects/{project_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let list = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let projects: Vec<serde_json::Value> =
        common::json_body(list).await.as_array().unwrap().clone();
    assert!(projects.is_empty());
}

#[tokio::test]
async fn test_close_project_hard_deletes_without_sessions() {
    let app = common::app();
    let project_id = common::seed_project(&app).await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/projects/{project_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let projects: Vec<serde_json::Value> =
        common::json_body(list).await.as_array().unwrap().clone();
    assert!(projects
        .iter()
        .all(|p| p["id"].as_str() != Some(project_id.as_str())));
}

#[tokio::test]
async fn test_readd_soft_removed_project_restores_same_id() {
    let app = common::app();
    let (_dir, project_id, project_path) = common::setup_git_project(&app).await;
    common::seed_session(
        &app,
        &project_id,
        &common::v5_id_for_path(&project_path),
        true,
    )
    .await;

    app.clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/projects/{project_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let readd = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": project_path})),
        ))
        .await
        .unwrap();
    assert_eq!(readd.status(), StatusCode::OK);
    let body = common::json_body(readd).await;
    assert_eq!(body["id"].as_str().unwrap(), project_id);

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let projects: Vec<serde_json::Value> =
        common::json_body(list).await.as_array().unwrap().clone();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0]["id"].as_str().unwrap(), project_id);
}

#[tokio::test]
async fn test_create_project_normalizes_linked_worktree_path_to_main_repo() {
    use std::process::Command;

    let app = common::app();
    let (dir, project_id, main_path) = common::setup_git_project(&app).await;
    let linked = dir.path().join("linked-wt");
    Command::new("git")
        .args([
            "worktree",
            "add",
            linked.to_str().unwrap(),
            "-b",
            "linked-branch",
        ])
        .current_dir(&main_path)
        .output()
        .expect("git worktree add");

    let resp = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({ "path": linked.to_string_lossy() })),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::json_body(resp).await;
    assert_eq!(body["id"].as_str().unwrap(), project_id);

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let projects = common::json_body(list).await;
    let project = projects
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"].as_str() == Some(project_id.as_str()))
        .expect("reactivated project in list");
    assert_eq!(project["path"].as_str().unwrap(), main_path);
}

#[tokio::test]
async fn test_list_projects_returns_nested_worktree_sessions() {
    let app = common::app();
    let (_dir, project_id, project_path) = common::setup_git_project(&app).await;
    let main_worktree_id = common::v5_id_for_path(&project_path);
    let session_id = common::seed_session(&app, &project_id, &main_worktree_id, true).await;

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list.status(), StatusCode::OK);
    let projects = common::json_body(list).await;
    let project = &projects.as_array().unwrap()[0];

    assert!(project.get("sessions").is_none(), "no top-level sessions");
    let worktrees = project["worktrees"].as_array().unwrap();
    assert!(!worktrees.is_empty());

    let main = worktrees
        .iter()
        .find(|wt| !wt["isLinkedWorktree"].as_bool().unwrap())
        .expect("main worktree present");
    assert_eq!(main["id"].as_str().unwrap(), main_worktree_id);

    let sessions = main["sessions"].as_array().unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0]["id"].as_str().unwrap(), session_id);
    assert!(
        sessions[0].get("projectId").is_none(),
        "sidebar metadata is slim"
    );
}
