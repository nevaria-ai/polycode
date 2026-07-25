// Desktop host entry. Builder wiring lives here, not in lib.
//
// Mobile does not use this binary — it loads the lib via
// `#[cfg_attr(mobile, tauri::mobile_entry_point)]` when that lands.
//
// `esk_code` (lib) exposes shared modules this binary uses: db, git, cgo, feature
// modules, commands, error type, etc. Other binaries (`remote_server`, etc.) can reuse the lib
// without this desktop-specific entry.

// Prevents an additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(debug_assertions)]
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

fn main() {
    tracing_subscriber::fmt::init();

    let db = esk_code::db::init_db().expect("db");

    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        esk_code::commands::list_projects,
        esk_code::commands::create_project,
        esk_code::commands::close_project,
        esk_code::commands::create_session,
        esk_code::commands::get_session,
        esk_code::commands::update_session_title,
        esk_code::commands::archive_session,
        esk_code::commands::delete_session,
        esk_code::commands::create_worktree,
        esk_code::commands::delete_worktree,
        esk_code::commands::rename_worktree_branch,
        esk_code::commands::update_worktree_expanded_state,
        esk_code::commands::send_message,
        esk_code::commands::list_directories,
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "ui/src/lib/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .manage(db)
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
