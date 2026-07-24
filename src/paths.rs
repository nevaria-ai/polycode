use std::path::PathBuf;

use crate::constants::CONSTANTS;

pub fn data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var(&CONSTANTS.env_data_dir) {
        PathBuf::from(dir)
    } else {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(&CONSTANTS.data_dir_dot_name)
    }
}

pub fn db_path() -> PathBuf {
    data_dir().join(&CONSTANTS.db_file_name)
}

pub fn project_dir(project_id: &str) -> PathBuf {
    data_dir().join("projects").join(project_id)
}

/// App-managed git worktree checkout directory. Uses an opaque UUID folder name so branch renames
/// never need to move storage; users only see the checked-out branch name in the UI.
pub fn worktree_dir(project_id: &str, worktree_id: &str) -> PathBuf {
    project_dir(project_id).join("worktrees").join(worktree_id)
}
