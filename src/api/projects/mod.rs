mod model;
mod service;

pub use model::{CreateProject, Project};
pub use service::Service;

use std::collections::HashMap;
use std::path::Path;

use axum::extract::{Path as AxumPath, State};
use axum::routing::{get, patch};
use axum::{Json, Router};
use tokio::task::JoinSet;

use super::AppState;
use crate::api::types::*;
use crate::error::AppError;
use crate::git::worktree::GitOps;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/projects", get(list_projects).post(create_project))
        .route("/api/projects/{id}", get(get_project).delete(close_project))
        .route(
            "/api/projects/{id}/expanded-state",
            patch(update_expanded_state),
        )
}

async fn list_projects(State(state): State<AppState>) -> Result<Json<Vec<ApiProject>>, AppError> {
    let projects = Service::new(state.db).list().await?;
    let labels = derive_base_labels_parallel(&projects).await;
    let display_names = compute_display_names(&projects, &labels);
    let api_projects = projects
        .into_iter()
        .map(|p| {
            let (label, owner) = labels
                .get(&p.id)
                .cloned()
                .unwrap_or_else(|| (String::new(), None));
            let display_name = display_names.get(&p.id).cloned().unwrap_or(label);
            api_project_from_db(p, display_name, owner)
        })
        .collect();
    Ok(Json(api_projects))
}

async fn get_project(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<ApiProject>, AppError> {
    let project = Service::new(state.db).get(&id).await?;
    let (label, owner) = derive_base_label(&project.path);
    Ok(Json(api_project_from_db(project, label, owner)))
}

async fn create_project(
    State(state): State<AppState>,
    Json(input): Json<CreateProjectRequest>,
) -> Result<Json<CreateProjectResponse>, AppError> {
    let project = Service::new(state.db)
        .create(CreateProject { path: input.path })
        .await?;
    let (label, owner) = derive_base_label(&project.path);
    Ok(Json(CreateProjectResponse {
        project: api_project_from_db(project, label, owner),
    }))
}

async fn update_expanded_state(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Json(body): Json<UpdateExpandedStateRequest>,
) -> Result<Json<ApiProject>, AppError> {
    let project = Service::new(state.db)
        .update_expanded_state(&id, body.expanded_state)
        .await?;
    let (label, owner) = derive_base_label(&project.path);
    Ok(Json(api_project_from_db(project, label, owner)))
}

async fn close_project(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    Service::new(state.db).close(&id).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

fn api_project_from_db(
    project: Project,
    display_name: String,
    owner: Option<String>,
) -> ApiProject {
    ApiProject {
        id: project.id,
        path: project.path,
        expanded_state: project.expanded_state,
        created_at: format_iso8601(project.created_at),
        display_name,
        owner,
    }
}

/// Derives `(label, owner)` for a single project path — used by get/create (no collision pass).
fn derive_base_label(path: &str) -> (String, Option<String>) {
    let path_obj = Path::new(path);
    if let Some(remote_name) = GitOps::get_remote_origin_name(path_obj) {
        let owner = owner_from_remote_name(&remote_name);
        return (remote_name, owner);
    }
    (folder_basename(path), None)
}

/// `(display label, optional git owner)`
type ProjectLabel = (String, Option<String>);

async fn derive_base_labels_parallel(projects: &[Project]) -> HashMap<String, ProjectLabel> {
    let mut tasks: JoinSet<(String, ProjectLabel)> = JoinSet::new();
    for p in projects {
        let (id, path) = (p.id.clone(), p.path.clone());
        tasks.spawn_blocking(move || (id, derive_base_label(&path)));
    }

    let mut out = HashMap::new();
    while let Some(result) = tasks.join_next().await {
        match result {
            Ok((id, label)) => {
                out.insert(id, label);
            }
            Err(e) => {
                tracing::warn!("derive_base_labels_parallel task failed: {e}");
            }
        }
    }
    out
}

fn owner_from_remote_name(name: &str) -> Option<String> {
    let (owner, repo) = name.split_once('/')?;
    if owner.is_empty() || repo.is_empty() {
        return None;
    }
    Some(owner.to_string())
}

fn folder_basename(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Computes per-project `display_name` values for a list response.
///
/// Uses derived base labels for collision detection; the result is keyed by
/// project id. Unique labels keep the base name; collisions fall back to
/// `parentdir/foldername`, then to the full absolute `path`.
fn compute_display_names(
    projects: &[Project],
    labels: &HashMap<String, (String, Option<String>)>,
) -> HashMap<String, String> {
    let base_label = |id: &str| {
        labels
            .get(id)
            .map(|(label, _)| label.clone())
            .unwrap_or_default()
    };

    let mut display_names: HashMap<String, String> = projects
        .iter()
        .map(|p| (p.id.clone(), base_label(&p.id)))
        .collect();

    // Pass 1: count by base label and promote colliding projects to parent/folder.
    let mut counts: HashMap<String, usize> = HashMap::new();
    for p in projects.iter() {
        *counts.entry(base_label(&p.id)).or_insert(0) += 1;
    }
    for p in projects.iter() {
        if counts.get(&base_label(&p.id)).copied().unwrap_or(0) > 1 {
            display_names.insert(p.id.clone(), parent_slash_folder(&p.path));
        }
    }

    // Pass 2: if parent/folder still collides, fall back to absolute path.
    let mut display_counts: HashMap<String, usize> = HashMap::new();
    for p in projects.iter() {
        let dn = display_names.get(&p.id).cloned().unwrap_or_default();
        *display_counts.entry(dn).or_insert(0) += 1;
    }
    for p in projects.iter() {
        let dn = display_names.get(&p.id).cloned().unwrap_or_default();
        if display_counts.get(&dn).copied().unwrap_or(0) > 1 {
            display_names.insert(p.id.clone(), p.path.clone());
        }
    }

    display_names
}

/// Returns `"parent/folder"` for a path — the immediate parent dir name and final segment.
/// Falls back to just the final segment if the path has no parent (e.g. `/repo`).
fn parent_slash_folder(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    let p = Path::new(trimmed);
    let folder = p
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| trimmed.to_string());
    match p
        .parent()
        .and_then(|parent| parent.file_name())
        .map(|s| s.to_string_lossy().to_string())
    {
        Some(parent_name) if !parent_name.is_empty() && parent_name != "/" => {
            format!("{parent_name}/{folder}")
        }
        _ => folder,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db_project(id: &str, path: &str) -> Project {
        Project {
            id: id.to_string(),
            path: path.to_string(),
            expanded_state: false,
            created_at: 0,
            removed_at: None,
        }
    }

    fn labels(entries: &[(&str, &str)]) -> HashMap<String, (String, Option<String>)> {
        entries
            .iter()
            .map(|(id, label)| (id.to_string(), (label.to_string(), None)))
            .collect()
    }

    #[test]
    fn display_names_unique_keep_base_name() {
        let projects = vec![
            db_project("1", "/work/alpha"),
            db_project("2", "/work/beta"),
        ];
        let labels = labels(&[("1", "alpha"), ("2", "beta")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "alpha");
        assert_eq!(names["2"], "beta");
    }

    #[test]
    fn display_names_collide_both_get_parent_slash_folder() {
        let projects = vec![db_project("1", "/work/repo"), db_project("2", "/play/repo")];
        let labels = labels(&[("1", "repo"), ("2", "repo")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "work/repo");
        assert_eq!(names["2"], "play/repo");
    }

    #[test]
    fn display_names_single_project_keeps_base_name() {
        let projects = vec![db_project("1", "/work/solo")];
        let labels = labels(&[("1", "solo")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "solo");
    }

    #[test]
    fn parent_slash_folder_root_path_falls_back_to_folder() {
        assert_eq!(parent_slash_folder("/repo"), "repo");
    }

    #[test]
    fn parent_slash_folder_strips_trailing_slash() {
        assert_eq!(parent_slash_folder("/work/repo/"), "work/repo");
    }

    #[test]
    fn parent_slash_folder_nested_path_uses_immediate_parent_only() {
        assert_eq!(parent_slash_folder("/Users/me/work/repo"), "work/repo");
    }

    #[test]
    fn parent_slash_folder_empty_path_returns_empty() {
        assert_eq!(parent_slash_folder(""), "");
    }

    #[test]
    fn parent_slash_folder_root_only_returns_empty() {
        assert_eq!(parent_slash_folder("/"), "");
    }

    #[test]
    fn parent_slash_folder_relative_path() {
        assert_eq!(parent_slash_folder("work/repo"), "work/repo");
    }

    #[test]
    fn display_names_three_way_collision_all_get_fallback() {
        let projects = vec![
            db_project("1", "/a/repo"),
            db_project("2", "/b/repo"),
            db_project("3", "/c/repo"),
        ];
        let labels = labels(&[("1", "repo"), ("2", "repo"), ("3", "repo")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "a/repo");
        assert_eq!(names["2"], "b/repo");
        assert_eq!(names["3"], "c/repo");
    }

    #[test]
    fn display_names_partial_collision_only_matching_names_get_fallback() {
        let projects = vec![
            db_project("1", "/a/repo"),
            db_project("2", "/b/repo"),
            db_project("3", "/c/solo"),
        ];
        let labels = labels(&[("1", "repo"), ("2", "repo"), ("3", "solo")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "a/repo");
        assert_eq!(names["2"], "b/repo");
        assert_eq!(names["3"], "solo");
    }

    #[test]
    fn display_names_empty_input_is_noop() {
        let names = compute_display_names(&[], &HashMap::new());
        assert!(names.is_empty());
    }

    #[test]
    fn display_names_uses_label_not_path_for_collision() {
        let projects = vec![db_project("1", "/work/repo"), db_project("2", "/play/repo")];
        let labels = labels(&[("1", "repo"), ("2", "repo")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "work/repo");
        assert_eq!(names["2"], "play/repo");
    }

    #[test]
    fn display_names_double_collision_falls_back_to_absolute_path() {
        let projects = vec![
            db_project("1", "/path1/temp/temp"),
            db_project("2", "/path2/temp/temp"),
        ];
        let labels = labels(&[("1", "temp"), ("2", "temp")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "/path1/temp/temp");
        assert_eq!(names["2"], "/path2/temp/temp");
    }

    #[test]
    fn display_names_double_collision_mixed_with_single_collision() {
        let projects = vec![
            db_project("1", "/alpha/temp/temp"),
            db_project("2", "/beta/temp/temp"),
            db_project("3", "/unique/temp"),
        ];
        let labels = labels(&[("1", "temp"), ("2", "temp"), ("3", "temp")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "/alpha/temp/temp");
        assert_eq!(names["2"], "/beta/temp/temp");
        assert_eq!(names["3"], "unique/temp");
    }

    #[test]
    fn display_names_no_fallback_when_parent_folder_disambiguates() {
        let projects = vec![db_project("1", "/work/repo"), db_project("2", "/play/repo")];
        let labels = labels(&[("1", "repo"), ("2", "repo")]);
        let names = compute_display_names(&projects, &labels);
        assert_eq!(names["1"], "work/repo");
        assert_eq!(names["2"], "play/repo");
    }

    #[test]
    fn owner_from_remote_name_owner_repo_form() {
        assert_eq!(
            owner_from_remote_name("nevaria/polycode"),
            Some("nevaria".to_string())
        );
    }

    #[test]
    fn owner_from_remote_name_rejects_malformed() {
        assert_eq!(owner_from_remote_name("nevaria/"), None);
        assert_eq!(owner_from_remote_name("/polycode"), None);
    }

    #[test]
    fn folder_basename_uses_final_segment() {
        assert_eq!(folder_basename("/tmp/my-project"), "my-project");
    }

    #[test]
    fn derive_base_label_non_git_uses_folder_basename() {
        let (label, owner) = derive_base_label("/tmp/not-a-git-repo");
        assert_eq!(label, "not-a-git-repo");
        assert_eq!(owner, None);
    }

    #[tokio::test]
    async fn derive_base_labels_parallel_collects_all_projects() {
        let projects = vec![db_project("1", "/tmp/alpha"), db_project("2", "/tmp/beta")];
        let out = derive_base_labels_parallel(&projects).await;
        assert_eq!(out.len(), 2);
        assert_eq!(out["1"].0, "alpha");
        assert_eq!(out["2"].0, "beta");
    }
}
