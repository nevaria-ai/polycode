mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn test_get_directories_returns_200() {
    let app = common::app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/directories")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_get_directories_returns_json_object() {
    let app = common::app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/directories")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(result["suggestions"].is_array());
    assert!(result["exists"].is_boolean());
    let suggestions = result["suggestions"].as_array().unwrap();
    assert!(suggestions
        .iter()
        .all(|d| d.as_str().map(|s| !s.is_empty()).unwrap_or(false)));
}
