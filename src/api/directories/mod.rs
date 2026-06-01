use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;

use super::AppState;
use crate::api::types::DirectoryResponse;
use crate::error::AppError;

#[derive(Deserialize)]
struct DirQuery {
    q: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/directories", get(list))
}

async fn list(
    _state: State<AppState>,
    Query(query): Query<DirQuery>,
) -> Result<Json<DirectoryResponse>, AppError> {
    let q = query.q.unwrap_or_default();

    if q.is_empty() {
        return Ok(Json(DirectoryResponse {
            suggestions: vec![],
            exists: false,
        }));
    }

    let starts_with_tilde = q.starts_with('~');
    let home = dirs::home_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let expanded = if starts_with_tilde {
        format!("{}{}", home, &q[1..])
    } else {
        q.clone()
    };

    let ends_with_slash = expanded.ends_with('/');
    let normalized = if expanded == "/" {
        "/".to_string()
    } else if ends_with_slash {
        expanded[..expanded.len() - 1].to_string()
    } else {
        expanded.clone()
    };

    let path_exists = std::path::Path::new(&normalized).is_dir();

    let (parent, search_term): (String, String) = if ends_with_slash {
        if normalized == "/" {
            ("/".to_string(), "".to_string())
        } else {
            (normalized.clone(), "".to_string())
        }
    } else {
        let parent = std::path::Path::new(&normalized)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let search = std::path::Path::new(&normalized)
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        (parent, search)
    };

    let mut suggestions = Vec::new();

    if !parent.is_empty() && std::path::Path::new(&parent).is_dir() {
        if let Ok(entries) = std::fs::read_dir(&parent) {
            for entry in entries.filter_map(|e| e.ok()) {
                if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    continue;
                }

                let name = entry.file_name().to_string_lossy().to_string();
                let full_path = std::path::Path::new(&parent).join(&name);
                let full_path_str = full_path.to_string_lossy().to_string();

                let name_lower = name.to_lowercase();

                if ends_with_slash || name_lower.starts_with(&search_term) {
                    if !ends_with_slash
                        && !full_path_str
                            .to_lowercase()
                            .starts_with(&expanded.to_lowercase())
                    {
                        continue;
                    }

                    let display = if starts_with_tilde && full_path_str.starts_with(&home) {
                        format!("~{}", full_path_str[home.len()..].to_string())
                    } else {
                        full_path_str
                    };

                    suggestions.push(display);
                }

                if suggestions.len() >= 10 {
                    break;
                }
            }
        }
    }

    suggestions.sort();
    if let Some(idx) = suggestions
        .iter()
        .position(|s| s.to_lowercase() == normalized.to_lowercase())
    {
        let exact = suggestions.remove(idx);
        suggestions.insert(0, exact);
    }

    Ok(Json(DirectoryResponse {
        suggestions,
        exists: path_exists,
    }))
}
