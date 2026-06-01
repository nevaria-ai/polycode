//! Shared helpers for integration tests (`tests/*.rs`).
//!
//! Integration tests use only the crate's public API (`web::web_app`, `init_memory`).

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use polycode::db::DbHandle;
use serde_json::{json, Value};
use tower::ServiceExt;

pub fn memory_db() -> DbHandle {
    polycode::db::init_memory().expect("open test database")
}

pub fn app() -> Router {
    app_with(memory_db())
}

pub fn app_with(db: DbHandle) -> Router {
    polycode::web::web_app(db)
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

pub async fn seed_project(app: &Router) -> String {
    let resp = app
        .clone()
        .oneshot(json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": "/tmp/test-project"})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    json_body(resp).await["project"]["id"]
        .as_str()
        .unwrap()
        .to_string()
}

pub async fn seed_session(app: &Router, project_id: &str) -> String {
    let uri = format!("/api/projects/{project_id}/sessions");
    let resp = app
        .clone()
        .oneshot(json_request(
            "POST",
            &uri,
            Some(json!({"worktreePath": "/tmp/work"})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
    json_body(resp).await["session"]["id"]
        .as_str()
        .unwrap()
        .to_string()
}

pub async fn seed_project_and_session(app: &Router) -> (String, String) {
    let project_id = seed_project(app).await;
    let session_id = seed_session(app, &project_id).await;
    (project_id, session_id)
}
