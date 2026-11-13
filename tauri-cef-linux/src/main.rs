// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// CEF est multi-process : les subprocess (renderer, GPU, etc.) ré-exécutent
// ce binaire avec un argument --type=. La macro dispatche ces helpers vers
// run_cef_helper_process() et ne laisse le code applicatif tourner que dans
// le browser process.
#[tauri_runtime_cef::cef_entry_point]
fn main() {
    pnltracker_desktop_lib::run();
}
