use std::path::Path as FsPath;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;
use urlencoding::decode as percent_decode;

use super::AppState;
use crate::api::projects::{Project, Service as ProjectService};
use crate::api::types::*;
use crate::error::AppError;
use crate::git::worktree::GitOps;
use crate::paths;

fn worktree_id_from_path(path: &str) -> String {
    let mut hash: u128 = 0x6c62272e07bb014262b821756295c58d;
    for byte in path.as_bytes() {
        hash ^= u128::from(*byte);
        hash = hash.wrapping_mul(0x0000000001000000000000000000013B);
    }
    format!("{:032x}", hash)[..8].to_string()
}

fn slugify_project_name(name: &str) -> String {
    let mut slug = String::with_capacity(name.len());
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else if c == '-' || c == '_' || c == ' ' {
            slug.push('-');
        }
    }

    let collapsed = slug
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "project".to_string()
    } else {
        collapsed
    }
}

fn next_worktree_path(project_name: &str) -> Result<std::path::PathBuf, AppError> {
    let project_slug = slugify_project_name(project_name);
    let base = paths::data_dir().join("worktrees").join(project_slug);
    std::fs::create_dir_all(&base).map_err(|e| {
        AppError::BadRequest(format!(
            "failed to create worktree storage dir '{}': {e}",
            base.display()
        ))
    })?;

    for _ in 0..10 {
        let short_id = uuid::Uuid::new_v4().as_simple().to_string()[..8].to_string();
        let candidate = base.join(short_id);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(AppError::BadRequest(
        "failed to generate unique worktree path id".to_string(),
    ))
}

fn resolve_worktree_path(project_path: &str, worktree_ref: &str) -> Result<String, AppError> {
    let decoded_ref = percent_decode(worktree_ref)
        .map(|d| d.into_owned())
        .unwrap_or_else(|_| worktree_ref.to_string());

    let worktrees = GitOps::list_worktrees(FsPath::new(project_path))
        .map_err(|e| AppError::BadRequest(e.into()))?;

    if let Some(wt) = worktrees.iter().find(|wt| wt.path == decoded_ref) {
        return Ok(wt.path.clone());
    }
    if let Some(wt) = worktrees
        .iter()
        .find(|wt| worktree_id_from_path(&wt.path) == decoded_ref)
    {
        return Ok(wt.path.clone());
    }

    Err(AppError::NotFound("worktree not found".into()))
}

async fn load_project(state: &AppState, project_id: &str) -> Result<Project, AppError> {
    ProjectService::new(state.db.clone()).get(project_id).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    pub name: Option<String>,
    pub branch: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteBody {
    pub branch: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameBody {
    pub old_branch: String,
    pub new_branch: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/projects/{id}/worktrees", get(list))
        .route("/api/projects/{id}/worktrees/create", post(create))
        .route(
            "/api/projects/{id}/worktrees/{worktree_path}",
            delete(delete_one).patch(rename_one),
        )
}

async fn list(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
) -> Result<Json<Vec<ApiWorktree>>, AppError> {
    let project = load_project(&state, &project_id).await?;

    let worktrees = GitOps::list_worktrees(FsPath::new(&project.path))
        .map_err(|e| AppError::BadRequest(e.into()))?;

    let api_worktrees = worktrees
        .into_iter()
        .map(|wt| ApiWorktree {
            id: worktree_id_from_path(&wt.path),
            project_id: project_id.clone(),
            path: wt.path,
            name: wt.name,
            is_primary: wt.is_current,
            branch: wt.branch,
            last_synced_at: None,
            created_at: String::new(),
        })
        .collect();

    Ok(Json(api_worktrees))
}

async fn create(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<CreateWorktreeResponse>), AppError> {
    let project = load_project(&state, &project_id).await?;

    let worktree_path = next_worktree_path(&project.name)?;
    let wt = GitOps::create_worktree(FsPath::new(&project.path), &worktree_path, &body.branch)
        .map_err(|e| AppError::BadRequest(e.into()))?;

    Ok((
        StatusCode::CREATED,
        Json(CreateWorktreeResponse {
            worktree: ApiWorktree {
                id: worktree_id_from_path(&wt.path),
                project_id,
                path: wt.path,
                name: wt.name,
                is_primary: wt.is_current,
                branch: wt.branch,
                last_synced_at: None,
                created_at: String::new(),
            },
        }),
    ))
}

async fn delete_one(
    State(state): State<AppState>,
    Path((project_id, worktree_ref)): Path<(String, String)>,
    Json(body): Json<DeleteBody>,
) -> Result<StatusCode, AppError> {
    let project = load_project(&state, &project_id).await?;

    let resolved_path = resolve_worktree_path(&project.path, &worktree_ref)?;
    let worktree_path_obj = FsPath::new(&resolved_path);

    GitOps::delete_worktree(FsPath::new(&project.path), worktree_path_obj, &body.branch)
        .map_err(|e| AppError::BadRequest(e.into()))?;

    Ok(StatusCode::NO_CONTENT)
}

async fn rename_one(
    State(state): State<AppState>,
    Path((project_id, worktree_ref)): Path<(String, String)>,
    Json(body): Json<RenameBody>,
) -> Result<StatusCode, AppError> {
    let project = load_project(&state, &project_id).await?;

    let resolved_path = resolve_worktree_path(&project.path, &worktree_ref)?;
    let worktree_path_obj = FsPath::new(&resolved_path);

    GitOps::rename_worktree_branch(
        FsPath::new(&project.path),
        worktree_path_obj,
        &body.old_branch,
        &body.new_branch,
    )
    .map_err(|e| AppError::BadRequest(e.into()))?;

    Ok(StatusCode::NO_CONTENT)
}
