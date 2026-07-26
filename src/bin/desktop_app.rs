#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Desktop host entry. Mobile does not use this binary — it loads the lib via
// `#[cfg_attr(mobile, tauri::mobile_entry_point)]` on `esk_code::run()`.

fn main() {
    esk_code::run();
}
