use tauri::State;

use crate::db::DbHandle;
use crate::error::AppError;
use crate::features::projects::Service as ProjectService;
use crate::features::sessions::{CreateSession, Service};
use crate::features::types::{
    CreateSessionRequest, CreateSessionResponse, SessionDto, SessionViewResponse,
    UpdateSessionResponse, UpdateTitleRequest,
};

#[tauri::command]
#[specta::specta]
pub async fn create_session(
    db: State<'_, DbHandle>,
    project_id: String,
    input: CreateSessionRequest,
) -> Result<CreateSessionResponse, AppError> {
    let project = ProjectService::new(db.inner().clone())
        .get(&project_id)
        .await?;
    let session = Service::new(db.inner().clone())
        .create(CreateSession {
            project_id,
            project_path: project.path,
            worktree_id: input.worktree_id,
            first_session_under_worktree: input.first_session_under_worktree,
            title: input.title,
        })
        .await?;
    Ok(CreateSessionResponse {
        session: SessionDto::from(session),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_session(
    db: State<'_, DbHandle>,
    _project_id: String,
    session_id: String,
) -> Result<SessionViewResponse, AppError> {
    // Stub: full session view (messages / pinned context / provider runs) is out of
    // scope until session page work lands. Only the session row is populated.
    let session = Service::new(db.inner().clone()).get(&session_id).await?;
    Ok(SessionViewResponse {
        session: SessionDto::from(session),
        messages: vec![],
        pinned_context: vec![],
        has_summary: false,
        provider_runs: vec![],
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_session_title(
    db: State<'_, DbHandle>,
    _project_id: String,
    session_id: String,
    input: UpdateTitleRequest,
) -> Result<UpdateSessionResponse, AppError> {
    let session = Service::new(db.inner().clone())
        .update_title(&session_id, &input.title)
        .await?;
    Ok(UpdateSessionResponse {
        session: SessionDto::from(session),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn archive_session(
    db: State<'_, DbHandle>,
    _project_id: String,
    session_id: String,
) -> Result<UpdateSessionResponse, AppError> {
    let session = Service::new(db.inner().clone())
        .archive(&session_id)
        .await?;
    Ok(UpdateSessionResponse {
        session: SessionDto::from(session),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn delete_session(
    db: State<'_, DbHandle>,
    _project_id: String,
    session_id: String,
) -> Result<(), AppError> {
    Service::new(db.inner().clone()).delete(&session_id).await
}
