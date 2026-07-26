use tauri::State;

use crate::db::DbHandle;
use crate::error::AppError;
use crate::features::types::{CreateWorktreeRequest, RenameWorktreeBranchRequest};
use crate::features::worktrees::Service;

#[tauri::command]
#[specta::specta]
pub async fn create_worktree(
    db: State<'_, DbHandle>,
    project_id: String,
    input: CreateWorktreeRequest,
) -> Result<(), AppError> {
    Service::new(db.inner().clone())
        .create(&project_id, &input.branch)
        .await?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_worktree(
    db: State<'_, DbHandle>,
    project_id: String,
    worktree_id: String,
) -> Result<(), AppError> {
    Service::new(db.inner().clone())
        .delete_checkout(&project_id, &worktree_id)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn rename_worktree_branch(
    db: State<'_, DbHandle>,
    project_id: String,
    worktree_id: String,
    input: RenameWorktreeBranchRequest,
) -> Result<(), AppError> {
    Service::new(db.inner().clone())
        .rename_checked_out_branch(&project_id, &worktree_id, &input.new_branch)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn update_worktree_expanded_state(
    db: State<'_, DbHandle>,
    project_id: String,
    worktree_id: String,
    expanded_state: bool,
) -> Result<(), AppError> {
    Service::new(db.inner().clone())
        .set_expanded_state(&project_id, &worktree_id, expanded_state)
        .await
}
