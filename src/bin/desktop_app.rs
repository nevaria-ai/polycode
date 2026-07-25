// Desktop host entry. Builder wiring lives here, not in lib.
//
// Mobile does not use this binary — it loads the lib via
// `#[cfg_attr(mobile, tauri::mobile_entry_point)]` when that lands.
//
// `esk_code` (lib) exposes shared modules this binary uses: db, git, cgo, feature
// modules, error type, etc. Side binaries (`remote_server`, etc.) reuse the lib
// without pulling in this desktop-specific entry.

// Prevents an additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
