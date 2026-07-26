#[cfg(test)]
mod test_support;

extern crate self as esk_code;

pub mod cgo;
pub mod commands;
pub mod constants;
pub mod db;
pub mod error;
pub mod features;
pub mod git;
pub mod paths;
pub mod serde_sqlite;
pub mod utils;

#[cfg(debug_assertions)]
use specta_typescript::Typescript;

/// Tauri host bootstrap shared by the desktop bin and mobile.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    let db = db::init_db().expect("db");
    let builder = commands::specta_builder();

    // Idiomatic tauri-specta: export on every debug launch (e.g. `just dev`).
    // Path is the desktop UI tree; revisit if mobile uses a different frontend layout.
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
