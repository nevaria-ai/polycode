mod model;
mod service;

pub use model::{CreateSession, Session};
pub use service::Service;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, patch, post};
use axum::{Json, Router};

use super::AppState;
use crate::api::types::*;
use crate::error::AppError;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/sessions", get(list_all_sessions))
        .route("/api/projects/{pid}/sessions", get(list).post(create))
        .route(
            "/api/projects/{pid}/sessions/{sid}",
            get(get_one).delete(delete_one),
        )
        .route(
            "/api/projects/{pid}/sessions/{sid}/title",
            patch(update_title),
        )
        .route("/api/projects/{pid}/sessions/{sid}/archive", post(archive))
}

async fn list_all_sessions(
    State(state): State<AppState>,
) -> Result<Json<Vec<ApiSession>>, AppError> {
    let sessions = Service::new(state.db).list_all().await?;
    Ok(Json(sessions.into_iter().map(ApiSession::from).collect()))
}

async fn list(
    State(state): State<AppState>,
    Path(pid): Path<String>,
) -> Result<Json<Vec<ApiSession>>, AppError> {
    let sessions = Service::new(state.db).list_by_project(&pid).await?;
    Ok(Json(sessions.into_iter().map(ApiSession::from).collect()))
}

async fn create(
    State(state): State<AppState>,
    Path(pid): Path<String>,
    Json(body): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<CreateSessionResponse>), AppError> {
    let session = Service::new(state.db)
        .create(CreateSession {
            project_id: pid,
            worktree_path: body.worktree_path,
            worktree_id: body.worktree_id,
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

async fn get_one(
    State(state): State<AppState>,
    Path((_pid, sid)): Path<(String, String)>,
) -> Result<Json<SessionViewResponse>, AppError> {
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
