use tauri::State;

use crate::db::DbHandle;
use crate::error::AppError;
use crate::features::messages::{SendMessageRequest, Service};
use crate::features::types::{ApiMessage, SubmitMessageRequest};

#[tauri::command]
#[specta::specta]
pub async fn send_message(
    db: State<'_, DbHandle>,
    _project_id: String,
    session_id: String,
    input: SubmitMessageRequest,
) -> Result<ApiMessage, AppError> {
    let service_req = SendMessageRequest {
        content: input.content,
        mentions: input
            .mentions
            .map(|v| v.into_iter().map(|m| m.r#type).collect()),
        slash_command: input.slash_command.map(|s| s.command),
    };
    let msg = Service::new(db.inner().clone())
        .send_message(&session_id, &service_req)
        .await?;
    Ok(ApiMessage::from(msg))
}
