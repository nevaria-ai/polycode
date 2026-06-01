mod common;

use axum::http::StatusCode;
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn test_health_ok() {
    let app = common::app();
    let resp = app
        .oneshot(common::json_request("GET", "/api/health", None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_full_happy_path() {
    let app = common::app();

    let pid = common::seed_project(&app).await;
    let sid = common::seed_session(&app, &pid).await;

    let uri = format!("/api/projects/{pid}/sessions/{sid}/messages");
    let resp = app
        .clone()
        .oneshot(common::json_request(
            "POST",
            &uri,
            Some(json!({"content": "Hello, integration test!"})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let msg = common::json_body(resp).await;
    assert_eq!(msg["role"], "user");
    assert_eq!(msg["content"], "Hello, integration test!");
}

#[tokio::test]
async fn test_list_projects_after_create() {
    let app = common::app();
    common::seed_project(&app).await;

    let resp = app
        .oneshot(common::json_request("GET", "/api/projects", None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let projects = common::json_body(resp).await;
    assert_eq!(projects.as_array().unwrap().len(), 1);
}
