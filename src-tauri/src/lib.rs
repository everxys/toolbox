pub mod commands;
pub mod library;
pub mod ncm;
pub mod skills;
pub mod storage;

mod desktop;

use commands::{library as library_commands, ncm as ncm_commands, skills as skills_commands, storage as storage_commands};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ncm_commands::LoginState::default())
        .invoke_handler(tauri::generate_handler![
            ncm_commands::ncm_qr_create,
            ncm_commands::ncm_qr_check,
            ncm_commands::ncm_set_login_cookie,
            ncm_commands::ncm_login_status,
            ncm_commands::ncm_logout,
            ncm_commands::ncm_open_download_dir,
            ncm_commands::ncm_list_downloaded,
            ncm_commands::ncm_mark_downloaded,
            ncm_commands::ncm_mark_downloaded_many,
            ncm_commands::ncm_playlist_detail,
            ncm_commands::ncm_song_detail,
            ncm_commands::ncm_player_url,
            ncm_commands::ncm_download,
            library_commands::library_scan,
            library_commands::library_cached,
            library_commands::library_update_metadata,
            library_commands::library_set_read_status,
            library_commands::library_open_book,
            library_commands::library_rename_book,
            library_commands::library_delete_book,
            library_commands::library_import,
            skills_commands::skills_scan,
            skills_commands::skills_update_metadata,
            skills_commands::skills_list_categories,
            skills_commands::skills_save_category,
            skills_commands::skills_delete_category,
            skills_commands::skills_delete_skill,
            storage_commands::database_location,
            storage_commands::database_migrate,
            storage_commands::database_use_existing,
        ])
        .setup(desktop::setup)
        .on_window_event(desktop::on_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
