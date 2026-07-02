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
    assert_eq!(result["project"]["name"], "test-project");
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
    let first_id = common::json_body(first).await["project"]["id"]
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
    assert_eq!(second_body["project"]["id"].as_str().unwrap(), first_id);

    let list = app
        .oneshot(
            Request::builder()
                .uri("/api/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let projects: Vec<serde_json::Value> = common::json_body(list).await.as_array().unwrap().clone();
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
    let first_id = common::json_body(first).await["project"]["id"]
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
    let second_id = common::json_body(second).await["project"]["id"]
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

    // Unique names → displayName matches name, no parent-prefix fallback.
    for p in projects {
        assert_eq!(p["displayName"], p["name"]);
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
