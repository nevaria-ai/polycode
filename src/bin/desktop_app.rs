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

fn main() {
    tracing_subscriber::fmt::init();

    let db = esk_code::db::init_db().expect("db");

    let builder = esk_code::commands::specta_builder();

    // Idiomatic tauri-specta: export bindings on every debug launch (e.g. `just dev`).
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
