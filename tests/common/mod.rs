//! Shared helpers for integration tests (`tests/*.rs`).
//!
//! Integration tests use only the crate's public API (`api::routes`, `init_memory`).

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use polycode::api::AppState;
use polycode::db::DbHandle;
use serde_json::{json, Value};
use std::process::Command;
use tower::ServiceExt;
use uuid::Uuid;

pub fn memory_db() -> DbHandle {
    polycode::db::init_memory().expect("open test database")
}

pub fn app() -> Router {
    app_with(memory_db())
}

pub fn app_with(db: DbHandle) -> Router {
    polycode::api::routes().with_state(AppState { db })
}

pub fn json_request(method: &str, uri: &str, body: Option<Value>) -> Request<Body> {
    let mut builder = Request::builder().method(method).uri(uri);
    let body = match body {
        Some(v) => {
            builder = builder.header("content-type", "application/json");
            Body::from(serde_json::to_vec(&v).unwrap())
        }
        None => Body::empty(),
    };
    builder.body(body).unwrap()
}

pub async fn json_body(resp: axum::http::Response<Body>) -> Value {
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

pub fn v5_id_for_path(path: &str) -> String {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, path.as_bytes()).to_string()
}

pub async fn setup_git_project(app: &Router) -> (tempfile::TempDir, String, String) {
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

    let project_path = path.to_string_lossy().to_string();
    let project_id = seed_project_with(app, &project_path).await;
    (dir, project_id, project_path)
}

pub async fn seed_project(app: &Router) -> String {
    seed_project_with(app, "/tmp/test-project").await
}

pub async fn seed_project_with(app: &Router, path: &str) -> String {
    let resp = app
        .clone()
        .oneshot(json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": path})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    json_body(resp).await["project"]["id"]
        .as_str()
        .unwrap()
        .to_string()
}

pub async fn seed_session(
    app: &Router,
    project_id: &str,
    worktree_id: &str,
    first_session_under_worktree: bool,
) -> String {
    let uri = format!("/api/projects/{project_id}/sessions");
    let resp = app
        .clone()
        .oneshot(json_request(
            "POST",
            &uri,
            Some(json!({
                "worktreeId": worktree_id,
                "firstSessionUnderWorktree": first_session_under_worktree,
            })),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
    json_body(resp).await["session"]["id"]
        .as_str()
        .unwrap()
        .to_string()
}

pub async fn seed_project_and_session(app: &Router) -> (tempfile::TempDir, String, String) {
    let (dir, project_id, project_path) = setup_git_project(app).await;
    let worktree_id = v5_id_for_path(&project_path);
    let session_id = seed_session(app, &project_id, &worktree_id, true).await;
    (dir, project_id, session_id)
}
