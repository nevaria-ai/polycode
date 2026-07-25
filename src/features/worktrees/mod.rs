//! Worktree feature module.
//!
//! A *worktree* here is a git checkout location (path on disk). What users label in the UI is
//! usually the **branch checked out** in that worktree, not the folder path. Branch rename is a
//! git-only operation (`git branch -m`): the worktree path and stable worktree id stay the same, so
//! sessions and app storage never need to move. App-created worktrees use opaque UUID directory
//! names under `~/.esk-code/projects/<id>/worktrees/` so display renames never depend on paths.

mod model;
mod service;

pub use model::WorktreeRow;
pub use service::Service;
