mod common;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn test_list_sessions_empty() {
    let app = common::app();
    let pid = common::seed_project(&app).await;
    let req = Request::builder()
        .uri(format!("/api/projects/{pid}/sessions"))
        .body(Body::empty())
        .unwrap();
    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_create_session() {
    let app = common::app();
    let pid = common::seed_project(&app).await;
    let body = serde_json::json!({
        "worktreePath": "/tmp/worktree"
    });
    let req = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/projects/{pid}/sessions"))
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
}

#[tokio::test]
async fn test_get_session() {
    let app = common::app();
    let pid = common::seed_project(&app).await;
    let sid = common::seed_session(&app, &pid).await;
    let req = Request::builder()
        .uri(format!("/api/projects/{pid}/sessions/{sid}"))
        .body(Body::empty())
        .unwrap();
    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_get_session_not_found() {
    let app = common::app();
    let pid = common::seed_project(&app).await;
    let req = Request::builder()
        .uri(format!("/api/projects/{pid}/sessions/bogus"))
        .body(Body::empty())
        .unwrap();
    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_session() {
    let app = common::app();
    let pid = common::seed_project(&app).await;
    let sid = common::seed_session(&app, &pid).await;
    let req = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/projects/{pid}/sessions/{sid}"))
        .body(Body::empty())
        .unwrap();
    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
}
