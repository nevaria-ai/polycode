mod common;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn test_post_message() {
    let app = common::app();
    let (pid, sid) = common::seed_project_and_session(&app).await;

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

#[tokio::test]
async fn test_list_messages() {
    let app = common::app();
    let (pid, sid) = common::seed_project_and_session(&app).await;

    let post_body = serde_json::json!({ "content": "msg one" });
    app.clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/projects/{pid}/sessions/{sid}/messages"))
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&post_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let resp = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{pid}/sessions/{sid}/messages"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let messages: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(messages.len(), 1);
}
