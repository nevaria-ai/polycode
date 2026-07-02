mod model;
mod service;

pub use model::{CreateProject, Project};
pub use service::Service;

use axum::extract::{Path, State};
use axum::routing::{get, patch};
use axum::{Json, Router};

use super::AppState;
use crate::api::types::*;
use crate::error::AppError;

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
    let mut api_projects: Vec<ApiProject> = projects.into_iter().map(ApiProject::from).collect();
    apply_display_names(&mut api_projects);
    Ok(Json(api_projects))
}

async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiProject>, AppError> {
    let project = Service::new(state.db).get(&id).await?;
    Ok(Json(ApiProject::from(project)))
}

async fn create_project(
    State(state): State<AppState>,
    Json(input): Json<CreateProjectRequest>,
) -> Result<Json<CreateProjectResponse>, AppError> {
    let project = Service::new(state.db)
        .create(CreateProject { path: input.path })
        .await?;
    Ok(Json(CreateProjectResponse {
        project: ApiProject::from(project),
    }))
}

async fn update_expanded_state(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateExpandedStateRequest>,
) -> Result<Json<ApiProject>, AppError> {
    let project = Service::new(state.db)
        .update_expanded_state(&id, body.expanded_state)
        .await?;
    Ok(Json(ApiProject::from(project)))
}

async fn close_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    Service::new(state.db).close(&id).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

/// Fills `display_name` on projects whose `name` collides with another project's.
///
/// Resolution per colliding group:
/// 1. Try `name` (already set). Unique names keep it.
/// 2. On collision, try `parentdir/foldername` once.
/// 3. If that also collides, fall back to the full absolute `path`. No further
///    walking — two levels is enough to disambiguate the common case (two repos
///    of the same name in different parent dirs), and absolute path is the
///    unambiguous last resort.
fn apply_display_names(projects: &mut [ApiProject]) {
    use std::collections::HashMap;

    // Pass 1: count by base name and promote colliding projects to parent/folder.
    let mut counts: HashMap<String, usize> = HashMap::new();
    for p in projects.iter() {
        *counts.entry(p.name.clone()).or_insert(0) += 1;
    }
    for p in projects.iter_mut() {
        if counts.get(&p.name).copied().unwrap_or(0) > 1 {
            p.display_name = parent_slash_folder(&p.path);
        }
    }

    // Pass 2: if parent/folder still collides across projects, fall back to the
    // full absolute path for every project in that collision group.
    let mut display_counts: HashMap<String, usize> = HashMap::new();
    for p in projects.iter() {
        *display_counts.entry(p.display_name.clone()).or_insert(0) += 1;
    }
    for p in projects.iter_mut() {
        if display_counts.get(&p.display_name).copied().unwrap_or(0) > 1 {
            p.display_name = p.path.clone();
        }
    }
}

/// Returns `"parent/folder"` for a path — the immediate parent dir name and final segment.
/// Falls back to just the final segment if the path has no parent (e.g. `/repo`).
fn parent_slash_folder(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    let p = std::path::Path::new(trimmed);
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

    fn api_project(id: &str, name: &str, path: &str) -> ApiProject {
        ApiProject {
            id: id.to_string(),
            name: name.to_string(),
            path: path.to_string(),
            expanded_state: false,
            created_at: "2026-06-30T00:00:00Z".to_string(),
            display_name: name.to_string(),
        }
    }

    #[test]
    fn display_names_unique_keep_base_name() {
        let mut projects = vec![
            api_project("1", "alpha", "/work/alpha"),
            api_project("2", "beta", "/work/beta"),
        ];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "alpha");
        assert_eq!(projects[1].display_name, "beta");
    }

    #[test]
    fn display_names_collide_both_get_parent_slash_folder() {
        let mut projects = vec![
            api_project("1", "repo", "/work/repo"),
            api_project("2", "repo", "/play/repo"),
        ];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "work/repo");
        assert_eq!(projects[1].display_name, "play/repo");
    }

    #[test]
    fn display_names_single_project_keeps_base_name() {
        let mut projects = vec![api_project("1", "solo", "/work/solo")];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "solo");
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
        // Only the immediate parent dir name + folder — never the full path.
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
        let mut projects = vec![
            api_project("1", "repo", "/a/repo"),
            api_project("2", "repo", "/b/repo"),
            api_project("3", "repo", "/c/repo"),
        ];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "a/repo");
        assert_eq!(projects[1].display_name, "b/repo");
        assert_eq!(projects[2].display_name, "c/repo");
    }

    #[test]
    fn display_names_partial_collision_only_matching_names_get_fallback() {
        // Two projects share "repo", one has unique "solo". Only the two
        // colliding ones get the fallback; "solo" stays as base name.
        let mut projects = vec![
            api_project("1", "repo", "/a/repo"),
            api_project("2", "repo", "/b/repo"),
            api_project("3", "solo", "/c/solo"),
        ];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "a/repo");
        assert_eq!(projects[1].display_name, "b/repo");
        assert_eq!(projects[2].display_name, "solo");
    }

    #[test]
    fn display_names_empty_input_is_noop() {
        let mut projects: Vec<ApiProject> = vec![];
        apply_display_names(&mut projects);
        assert!(projects.is_empty());
    }

    #[test]
    fn display_names_uses_name_not_path_for_collision() {
        // Different paths but same name → collision. Same path is impossible
        // post-dedup but the helper is pure and should still group by name only.
        let mut projects = vec![
            api_project("1", "repo", "/work/repo"),
            api_project("2", "repo", "/play/repo"),
        ];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "work/repo");
        assert_eq!(projects[1].display_name, "play/repo");
        // name stays untouched — it's the source of truth.
        assert_eq!(projects[0].name, "repo");
        assert_eq!(projects[1].name, "repo");
    }

    #[test]
    fn display_names_double_collision_falls_back_to_absolute_path() {
        // Both name and parent/folder collide: /path1/temp/temp vs /path2/temp/temp.
        // parent_slash_folder returns "temp/temp" for both, so we fall back to the
        // full absolute path so each project remains uniquely identifiable.
        let mut projects = vec![
            api_project("1", "temp", "/path1/temp/temp"),
            api_project("2", "temp", "/path2/temp/temp"),
        ];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "/path1/temp/temp");
        assert_eq!(projects[1].display_name, "/path2/temp/temp");
    }

    #[test]
    fn display_names_double_collision_mixed_with_single_collision() {
        // Three projects share name "temp"; two of them also share parent/folder,
        // one does not. The unique-parent one keeps parent/folder; the colliding
        // pair falls back to absolute path.
        let mut projects = vec![
            api_project("1", "temp", "/alpha/temp/temp"),
            api_project("2", "temp", "/beta/temp/temp"),
            api_project("3", "temp", "/unique/temp"),
        ];
        apply_display_names(&mut projects);
        // Pass 1 promotes all three to parent/folder.
        // Pass 2: "temp/temp" appears twice → both fall back to absolute.
        // "unique/temp" appears once → stays.
        assert_eq!(projects[0].display_name, "/alpha/temp/temp");
        assert_eq!(projects[1].display_name, "/beta/temp/temp");
        assert_eq!(projects[2].display_name, "unique/temp");
    }

    #[test]
    fn display_names_no_fallback_when_parent_folder_disambiguates() {
        // Sanity: the common case still works. Two repos of same name in
        // different parent dirs → parent/folder, no absolute fallback.
        let mut projects = vec![
            api_project("1", "repo", "/work/repo"),
            api_project("2", "repo", "/play/repo"),
        ];
        apply_display_names(&mut projects);
        assert_eq!(projects[0].display_name, "work/repo");
        assert_eq!(projects[1].display_name, "play/repo");
    }
}
