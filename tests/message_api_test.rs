mod common;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn test_post_message() {
    let app = common::app();
    let (_dir, pid, sid) = common::seed_project_and_session(&app).await;

    let body = serde_json::json!({
        "content": "Hello from test"
    });
    let req = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/projects/{pid}/sessions/{sid}/messages"))
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let val = common::json_body(resp).await;
    assert_eq!(val["role"], "user");
    assert_eq!(val["content"], "Hello from test");
    assert_eq!(val["sessionId"], sid);
}
