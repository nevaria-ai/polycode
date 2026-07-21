//! Worktree HTTP API.
//!
//! A *worktree* here is a git checkout location (path on disk). What users label in the UI is
//! usually the **branch checked out** in that worktree, not the folder path. Branch rename is a
//! git-only operation (`git branch -m`): the worktree path and stable worktree id stay the same, so
//! sessions and app storage never need to move. App-created worktrees use opaque UUID directory
//! names under `~/.polycode/projects/<id>/worktrees/` so display renames never depend on paths.

mod model;
mod service;

pub use model::WorktreeRow;
pub use service::Service;

use std::path::Path as FsPath;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, post};
use axum::{Json, Router};
use serde::Deserialize;

use super::AppState;
use crate::api::projects::Service as ProjectService;
use crate::error::AppError;
use crate::git::worktree::GitOps;
use crate::paths;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    pub branch: String,
}

/// Body for renaming the branch checked out in a worktree (`git branch -m`), not the worktree path.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameBranchBody {
    pub new_branch: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/projects/{id}/worktrees/create", post(create))
        .route(
            "/api/projects/{id}/worktrees/{worktree_id}",
            delete(delete_one).patch(rename_checked_out_branch),
        )
}

async fn create(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateBody>,
) -> Result<StatusCode, AppError> {
    let project = ProjectService::new(state.db.clone())
        .get(&project_id)
        .await?;

    let worktree_id = uuid::Uuid::new_v4().to_string();
    let worktree_path = paths::worktree_dir(&project_id, &worktree_id);
    std::fs::create_dir_all(worktree_path.parent().unwrap())
        .map_err(|e| AppError::BadRequest(format!("failed to create worktree storage dir: {e}")))?;

    GitOps::create_worktree(FsPath::new(&project.path), &worktree_path, &body.branch)
        .map_err(AppError::BadRequest)?;

    Ok(StatusCode::CREATED)
}

async fn delete_one(
    State(state): State<AppState>,
    Path((project_id, worktree_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    let project = ProjectService::new(state.db.clone())
        .get(&project_id)
        .await?;
    let svc = Service::new(state.db.clone());
    let path = svc
        .path_for_id(&project_id, &project.path, &worktree_id)
        .await?;

    GitOps::delete_worktree(FsPath::new(&project.path), FsPath::new(&path))
        .map_err(AppError::BadRequest)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Rename the branch checked out in a worktree. Path and worktree id are unchanged.
async fn rename_checked_out_branch(
    State(state): State<AppState>,
    Path((project_id, worktree_id)): Path<(String, String)>,
    Json(body): Json<RenameBranchBody>,
) -> Result<StatusCode, AppError> {
    let project = ProjectService::new(state.db.clone())
        .get(&project_id)
        .await?;
    let svc = Service::new(state.db.clone());
    let path = svc
        .path_for_id(&project_id, &project.path, &worktree_id)
        .await?;

    GitOps::rename_worktree_branch(
        FsPath::new(&project.path),
        FsPath::new(&path),
        &body.new_branch,
    )
    .map_err(AppError::BadRequest)?;

    Ok(StatusCode::NO_CONTENT)
}
