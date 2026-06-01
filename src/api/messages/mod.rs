mod model;
mod service;

pub use model::{Message, Part};
pub use service::{SendMessageRequest, Service};

use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;

use super::AppState;
use crate::api::types::{ApiMessage, SubmitMessageRequest};
use crate::error::AppError;

#[derive(Deserialize)]
#[allow(dead_code)]
struct SessionPath {
    pid: String,
    sid: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/projects/{pid}/sessions/{sid}/messages",
        get(list_messages).post(send_message),
    )
}

async fn send_message(
    State(state): State<AppState>,
    Path(path): Path<SessionPath>,
    Json(body): Json<SubmitMessageRequest>,
) -> Result<Json<ApiMessage>, AppError> {
    let service = Service::new(state.db.clone());
    let service_req = SendMessageRequest {
        content: body.content.clone(),
        mentions: body
            .mentions
            .map(|v| v.into_iter().map(|m| m.r#type).collect()),
        slash_command: body.slash_command.map(|s| s.command),
    };
    let msg = service.send_message(&path.sid, &service_req).await?;

    Ok(Json(ApiMessage::from(msg)))
}

async fn list_messages(
    State(state): State<AppState>,
    Path(path): Path<SessionPath>,
) -> Result<Json<Vec<ApiMessage>>, AppError> {
    let messages = Service::new(state.db.clone())
        .list_messages(&path.sid)
        .await?;
    Ok(Json(messages.into_iter().map(ApiMessage::from).collect()))
}
