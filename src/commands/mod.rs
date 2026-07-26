//! Thin Tauri IPC wrappers over [`crate::features`].

mod directories;
mod messages;
mod projects;
mod sessions;
mod worktrees;

pub use directories::*;
pub use messages::*;
pub use projects::*;
pub use sessions::*;
pub use worktrees::*;

use tauri_specta::{collect_commands, Builder};

/// Shared specta command registration for the desktop bin and bindings export test.
/// Does not start the Tauri app — window/db wiring stays in `desktop_app`.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        list_projects,
        create_project,
        close_project,
        create_session,
        get_session,
        update_session_title,
        archive_session,
        delete_session,
        create_worktree,
        delete_worktree,
        rename_worktree_branch,
        update_worktree_expanded_state,
        send_message,
        list_directories,
    ])
}

#[cfg(test)]
mod tests {
    use super::specta_builder;
    use specta_typescript::Typescript;

    /// Escape hatch: regenerate `ui/src/lib/bindings.ts` without launching the GUI.
    /// Prefer debug startup export via `just dev` day-to-day; use this for lint/build/CI.
    #[test]
    fn export_bindings() {
        specta_builder()
            .export(Typescript::default(), "ui/src/lib/bindings.ts")
            .expect("Failed to export typescript bindings");
    }
}
