use tauri::State;

use crate::db::DbHandle;
use crate::error::AppError;
use crate::features::projects::{CreateProject, Service};
use crate::features::types::{CreateProjectRequest, CreateProjectResponse, ProjectDto};

#[tauri::command]
#[specta::specta]
pub async fn list_projects(db: State<'_, DbHandle>) -> Result<Vec<ProjectDto>, AppError> {
    Service::new(db.inner().clone()).list_trees().await
}

#[tauri::command]
#[specta::specta]
pub async fn create_project(
    db: State<'_, DbHandle>,
    input: CreateProjectRequest,
) -> Result<CreateProjectResponse, AppError> {
    let project = Service::new(db.inner().clone())
        .create(CreateProject { path: input.path })
        .await?;
    Ok(CreateProjectResponse { id: project.id })
}

#[tauri::command]
#[specta::specta]
pub async fn close_project(db: State<'_, DbHandle>, id: String) -> Result<(), AppError> {
    Service::new(db.inner().clone()).close(&id).await
}
