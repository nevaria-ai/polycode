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
    Ok(Json(projects.into_iter().map(ApiProject::from).collect()))
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
