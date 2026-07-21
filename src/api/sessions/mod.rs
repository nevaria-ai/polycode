mod model;
mod service;

pub use model::{CreateSession, Session};
pub use service::Service;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, patch, post};
use axum::{Json, Router};

use super::AppState;
use crate::api::projects::Service as ProjectService;
use crate::api::types::*;
use crate::error::AppError;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/projects/{pid}/sessions", post(create))
        .route(
            "/api/projects/{pid}/sessions/{sid}",
            get(get_session).delete(delete_one),
        )
        .route(
            "/api/projects/{pid}/sessions/{sid}/title",
            patch(update_title),
        )
        .route("/api/projects/{pid}/sessions/{sid}/archive", post(archive))
}

async fn create(
    State(state): State<AppState>,
    Path(pid): Path<String>,
    Json(body): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<CreateSessionResponse>), AppError> {
    let project = ProjectService::new(state.db.clone()).get(&pid).await?;
    let session = Service::new(state.db)
        .create(CreateSession {
            project_id: pid,
            project_path: project.path,
            worktree_id: body.worktree_id,
            first_session_under_worktree: body.first_session_under_worktree,
            title: body.title,
        })
        .await?;
    Ok((
        StatusCode::CREATED,
        Json(CreateSessionResponse {
            session: ApiSession::from(session),
        }),
    ))
}

async fn get_session(
    State(state): State<AppState>,
    Path((_pid, sid)): Path<(String, String)>,
) -> Result<Json<SessionViewResponse>, AppError> {
    // Stub: full session view (messages / pinned context / provider runs) is out of
    // scope until session page work lands. Only the session row is populated.
    let session = Service::new(state.db).get(&sid).await?;
    Ok(Json(SessionViewResponse {
        session: ApiSession::from(session),
        messages: vec![],
        pinned_context: vec![],
        has_summary: false,
        provider_runs: vec![],
    }))
}

async fn delete_one(
    State(state): State<AppState>,
    Path((_pid, sid)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    Service::new(state.db).delete(&sid).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn update_title(
    State(state): State<AppState>,
    Path((_pid, sid)): Path<(String, String)>,
    Json(body): Json<UpdateTitleRequest>,
) -> Result<Json<UpdateSessionResponse>, AppError> {
    let session = Service::new(state.db)
        .update_title(&sid, &body.title)
        .await?;
    Ok(Json(UpdateSessionResponse {
        session: ApiSession::from(session),
    }))
}

async fn archive(
    State(state): State<AppState>,
    Path((_pid, sid)): Path<(String, String)>,
) -> Result<Json<UpdateSessionResponse>, AppError> {
    let session = Service::new(state.db).archive(&sid).await?;
    Ok(Json(UpdateSessionResponse {
        session: ApiSession::from(session),
    }))
}
