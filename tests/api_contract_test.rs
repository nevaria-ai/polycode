mod common;

use axum::http::StatusCode;
use serde_json::{json, Value};
use tower::ServiceExt;

fn assert_no_snake_case_keys(val: &Value, context: &str) {
    match val {
        Value::Object(map) => {
            for key in map.keys() {
                assert!(
                    !key.contains('_'),
                    "{context}: found snake_case key '{key}'",
                );
                assert_no_snake_case_keys(&map[key], context);
            }
        }
        Value::Array(arr) => {
            for item in arr {
                assert_no_snake_case_keys(item, context);
            }
        }
        _ => {}
    }
}

fn assert_iso8601(val: &Value, field: &str) {
    let s = val
        .as_str()
        .unwrap_or_else(|| panic!("{field} should be a string"));
    assert!(
        s.contains('T') && s.contains('-'),
        "{field} should be ISO 8601, got: {s}",
    );
}

// ─── Directory Contract ──────────────────────────────────────────

#[tokio::test]
async fn contract_directory_response_has_camel_case_keys() {
    let app = common::app();
    let resp = app
        .oneshot(common::json_request("GET", "/api/directories", None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = common::json_body(resp).await;
    assert_no_snake_case_keys(&json, "GET /api/directories");
}

#[tokio::test]
async fn contract_directory_response_shape() {
    let app = common::app();
    let resp = app
        .oneshot(common::json_request("GET", "/api/directories", None))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    assert!(
        json["suggestions"].is_array(),
        "must have 'suggestions' array"
    );
    assert!(json["exists"].is_boolean(), "must have 'exists' boolean");
}

// ─── Project Contract ────────────────────────────────────────────

#[tokio::test]
async fn contract_create_project_response_returns_id() {
    let app = common::app();
    let resp = app
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": "/tmp/ct"})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = common::json_body(resp).await;

    assert!(json["id"].is_string(), "must return project id");
    assert!(
        json.get("project").is_none(),
        "must not wrap a project tree"
    );
    assert_no_snake_case_keys(&json, "POST /api/projects");
}

#[tokio::test]
async fn contract_create_project_no_snake_case() {
    let app = common::app();
    let resp = app
        .oneshot(common::json_request(
            "POST",
            "/api/projects",
            Some(json!({"path": "/tmp/ns"})),
        ))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    assert!(json.get("created_at").is_none());
    assert!(json.get("project_id").is_none());
    assert!(json.get("id").is_some());
}

#[tokio::test]
async fn contract_list_projects_camel_case() {
    let app = common::app();
    common::seed_project(&app).await;
    let resp = app
        .oneshot(common::json_request("GET", "/api/projects", None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = common::json_body(resp).await;
    let arr = json.as_array().expect("list should be array");
    assert!(!arr.is_empty());
    assert_no_snake_case_keys(&json, "GET /api/projects");
}

#[tokio::test]
async fn contract_list_projects_timestamps_iso8601() {
    let app = common::app();
    common::seed_project(&app).await;
    let resp = app
        .oneshot(common::json_request("GET", "/api/projects", None))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    let first = &json.as_array().unwrap()[0];
    assert_iso8601(&first["createdAt"], "project.createdAt");
}

// ─── Session Contract ────────────────────────────────────────────

#[tokio::test]
async fn contract_create_session_response_camel_case_and_wrapped() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    let worktree_id = common::v5_id_for_path(&project_path);
    let resp = app
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{pid}/sessions"),
            Some(json!({"worktreeId": worktree_id, "firstSessionUnderWorktree": true})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
    let json = common::json_body(resp).await;
    assert!(json["session"].is_object(), "must be wrapped in 'session'");
    assert_no_snake_case_keys(&json, "POST /api/projects/{pid}/sessions");
}

#[tokio::test]
async fn contract_session_has_summary_is_boolean() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    let worktree_id = common::v5_id_for_path(&project_path);
    let resp = app
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{pid}/sessions"),
            Some(json!({"worktreeId": worktree_id, "firstSessionUnderWorktree": true})),
        ))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    let session = &json["session"];
    assert!(
        session["hasSummary"].is_boolean(),
        "hasSummary must be boolean, got: {:?}",
        session["hasSummary"],
    );
    assert!(
        session.get("has_summary").is_none(),
        "should not have has_summary"
    );
}

#[tokio::test]
async fn contract_session_no_snake_case_keys() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    let worktree_id = common::v5_id_for_path(&project_path);
    let resp = app
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{pid}/sessions"),
            Some(json!({"worktreeId": worktree_id, "firstSessionUnderWorktree": true})),
        ))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    let session = &json["session"];
    assert!(session.get("project_id").is_none(), "no project_id");
    assert!(session.get("worktree_path").is_none(), "no worktree_path");
    assert!(session.get("worktree_id").is_none(), "no worktree_id");
    assert!(session.get("created_at").is_none(), "no created_at");
    assert!(session.get("last_active_at").is_none(), "no last_active_at");
    assert!(session.get("projectId").is_some(), "has projectId");
    assert!(session.get("worktreePath").is_some(), "has worktreePath");
    assert!(session.get("createdAt").is_some(), "has createdAt");
    assert!(session.get("lastActiveAt").is_some(), "has lastActiveAt");
}

#[tokio::test]
async fn contract_session_timestamps_iso8601() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    let worktree_id = common::v5_id_for_path(&project_path);
    let resp = app
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{pid}/sessions"),
            Some(json!({"worktreeId": worktree_id, "firstSessionUnderWorktree": true})),
        ))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    let session = &json["session"];
    assert_iso8601(&session["createdAt"], "session.createdAt");
    assert_iso8601(&session["updatedAt"], "session.updatedAt");
    assert_iso8601(&session["lastActiveAt"], "session.lastActiveAt");
}

#[tokio::test]
async fn contract_list_projects_nested_tree_camel_case() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    common::seed_session(&app, &pid, &common::v5_id_for_path(&project_path), true).await;
    let resp = app
        .oneshot(common::json_request("GET", "/api/projects", None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = common::json_body(resp).await;
    assert_no_snake_case_keys(&json, "GET /api/projects");
    let project = &json.as_array().unwrap()[0];
    assert!(project["worktrees"].is_array());
    assert!(project.get("sessions").is_none());
    let main = project["worktrees"]
        .as_array()
        .unwrap()
        .iter()
        .find(|wt| !wt["isLinkedWorktree"].as_bool().unwrap())
        .expect("main worktree");
    assert!(main["sessions"].is_array());
}

// ─── Message Contract ────────────────────────────────────────────

#[tokio::test]
async fn contract_create_message_camel_case() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    let sid = common::seed_session(&app, &pid, &common::v5_id_for_path(&project_path), true).await;
    let resp = app
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{pid}/sessions/{sid}/messages"),
            Some(json!({"content": "contract test message"})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = common::json_body(resp).await;
    assert_no_snake_case_keys(&json, "POST .../messages");
}

#[tokio::test]
async fn contract_message_has_session_id_camel_case() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    let sid = common::seed_session(&app, &pid, &common::v5_id_for_path(&project_path), true).await;
    let resp = app
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{pid}/sessions/{sid}/messages"),
            Some(json!({"content": "check session id"})),
        ))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    assert!(json.get("sessionId").is_some(), "has sessionId");
    assert!(json.get("session_id").is_none(), "no session_id");
    assert_eq!(json["sessionId"], sid);
}

#[tokio::test]
async fn contract_message_timestamp_iso8601() {
    let app = common::app();
    let (_dir, pid, project_path) = common::setup_git_project(&app).await;
    let sid = common::seed_session(&app, &pid, &common::v5_id_for_path(&project_path), true).await;
    let resp = app
        .oneshot(common::json_request(
            "POST",
            &format!("/api/projects/{pid}/sessions/{sid}/messages"),
            Some(json!({"content": "ts check"})),
        ))
        .await
        .unwrap();
    let json = common::json_body(resp).await;
    assert_iso8601(&json["createdAt"], "message.createdAt");
}
