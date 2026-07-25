// Tauri desktop entry. Builder wiring lives here, not in lib.
//
// `esk_code` (lib) exposes shared modules the binary uses: db, git, cgo, feature
// modules, error type, etc. Future binaries (`remote_server`, etc.) reuse the lib
// without pulling in this Tauri-specific entry.

// Prevents an additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
