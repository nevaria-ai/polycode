mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use std::process::Command;
use tower::ServiceExt;

async fn setup_git_project() -> (axum::Router, tempfile::TempDir, String) {
    let app = common::app();
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path();
    Command::new("git")
        .args(["init", "-b", "main"])
        .current_dir(path)
        .output()
        .expect("git init");
    Command::new("git")
        .args(["config", "user.email", "test@test.com"])
        .current_dir(path)
        .output()
        .expect("git config email");
    Command::new("git")
        .args(["config", "user.name", "Test"])
        .current_dir(path)
        .output()
        .expect("git config name");
    Command::new("touch")
        .arg(path.join("README.md"))
        .output()
        .expect("touch");
    Command::new("git")
        .args(["add", "."])
        .current_dir(path)
        .output()
        .expect("git add");
    Command::new("git")
        .args(["commit", "-m", "init"])
        .current_dir(path)
        .output()
        .expect("git commit");

    let resp = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(serde_json::json!({"path": path.to_string_lossy()})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let project_id = common::json_body(resp).await["project"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    (app, dir, project_id)
}

#[tokio::test]
async fn test_list_worktrees_empty_project() {
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
async fn test_list_worktrees() {
    let (app, _dir, project_id) = setup_git_project().await;
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{project_id}/worktrees"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
