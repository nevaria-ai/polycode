use crate::error::AppError;
use crate::features::directories::list_directories as list_directories_inner;
use crate::features::types::DirectoryResponse;

#[tauri::command]
#[specta::specta]
pub async fn list_directories(q: Option<String>) -> Result<DirectoryResponse, AppError> {
    list_directories_inner(q.as_deref().unwrap_or(""))
}
