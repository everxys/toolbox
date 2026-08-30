#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
use commands::ncm;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            ncm::ncm_qr_create,
            ncm::ncm_qr_check,
            ncm::ncm_playlist_detail,
            ncm::ncm_song_detail,
            ncm::ncm_player_url,
            ncm::ncm_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
