//! Shared helpers for feature-module integration tests (`tests/*.rs`).
#![allow(dead_code)]

use esk_code::db::DbHandle;
use esk_code::features::projects::{CreateProject, Service as ProjectService};
use esk_code::features::sessions::{CreateSession, Service as SessionService};
use std::process::Command;
use uuid::Uuid;

pub fn memory_db() -> DbHandle {
    esk_code::db::init_memory().expect("open test database")
}

pub fn v5_id_for_path(path: &str) -> String {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, path.as_bytes()).to_string()
}

pub fn init_git_repo(path: &std::path::Path) {
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
}

pub async fn setup_git_project(db: DbHandle) -> (tempfile::TempDir, String, String) {
    let dir = tempfile::TempDir::new().unwrap();
    init_git_repo(dir.path());
    let project_path = dir.path().to_string_lossy().to_string();
    let project = ProjectService::new(db)
        .create(CreateProject {
            path: project_path.clone(),
        })
        .await
        .expect("create project");
    (dir, project.id, project_path)
}

pub async fn create_session(
    db: DbHandle,
    project_id: &str,
    project_path: &str,
    worktree_id: &str,
    first_session_under_worktree: bool,
) -> esk_code::features::sessions::Session {
    SessionService::new(db)
        .create(CreateSession {
            project_id: project_id.to_string(),
            project_path: project_path.to_string(),
            worktree_id: worktree_id.to_string(),
            first_session_under_worktree,
            title: None,
        })
        .await
        .expect("create session")
}

pub fn git_worktree_add(repo: &str, path: &std::path::Path, branch: &str) {
    let status = Command::new("git")
        .args([
            "worktree",
            "add",
            path.to_str().unwrap(),
            "-b",
            branch,
        ])
        .current_dir(repo)
        .status()
        .expect("git worktree add");
    assert!(status.success(), "git worktree add failed");
}

pub fn git_worktree_remove(repo: &str, path: &str) {
    let status = Command::new("git")
        .args(["worktree", "remove", path, "--force"])
        .current_dir(repo)
        .status()
        .expect("git worktree remove");
    assert!(status.success(), "git worktree remove failed");
}
