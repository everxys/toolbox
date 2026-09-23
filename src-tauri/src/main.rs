#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
use commands::{library, ncm, skills};
use tauri::Manager;

#[derive(serde::Serialize, serde::Deserialize)]
struct SavedWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    #[serde(default)]
    maximized: bool,
}

fn window_state_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("main-window-state.json"))
}

fn save_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return; };
    let Ok(position) = window.outer_position() else { return; };
    let Ok(size) = window.outer_size() else { return; };
    let maximized = window.is_maximized().unwrap_or(false);
    let state = SavedWindowState { x: position.x, y: position.y, width: size.width, height: size.height, maximized };
    if let Ok(path) = window_state_path(app) { let _ = std::fs::write(path, serde_json::to_vec(&state).unwrap_or_default()); }
}

fn restore_main_window(app: &tauri::AppHandle) {
    let Ok(path) = window_state_path(app) else { return; };
    let Ok(contents) = std::fs::read(path) else { return; };
    let Ok(state) = serde_json::from_slice::<SavedWindowState>(&contents) else { return; };
    // Reject obviously invalid values; a first launch uses tauri.conf.json defaults.
    if state.width < 400 || state.height < 300 || state.width > 10000 || state.height > 10000 { return; }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_size(tauri::PhysicalSize::new(state.width, state.height));
        let _ = window.set_position(tauri::PhysicalPosition::new(state.x, state.y));
        if state.maximized { let _ = window.maximize(); }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(ncm::LoginState::default())
        .invoke_handler(tauri::generate_handler![
            ncm::ncm_qr_create,
            ncm::ncm_qr_check,
            ncm::ncm_set_login_cookie,
            ncm::ncm_login_status,
            ncm::ncm_logout,
            ncm::ncm_open_download_dir,
            ncm::ncm_list_downloaded,
            ncm::ncm_mark_downloaded,
            ncm::ncm_mark_downloaded_many,
            ncm::ncm_playlist_detail,
            ncm::ncm_song_detail,
            ncm::ncm_player_url,
            ncm::ncm_download,
            library::library_scan,
            library::library_cached,
            library::library_update_metadata,
            library::library_set_read_status,
            library::library_open_book,
            library::library_rename_book,
            library::library_delete_book,
            library::library_import,
            skills::skills_scan,
            skills::skills_update_metadata,
            skills::skills_list_categories,
            skills::skills_save_category,
            skills::skills_delete_category,
            skills::skills_delete_skill,
        ])
        .setup(|app| {
            use tauri::{
                menu::{MenuBuilder, MenuItemBuilder},
                tray::{MouseButton, TrayIconBuilder},
                Manager,
            };
            restore_main_window(&app.handle());
            let quit_item = MenuItemBuilder::with_id("quit", "退出 Toolbox").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&quit_item]).build()?;
            let tray_builder = TrayIconBuilder::with_id("toolbox-tray")
                .menu(&menu)
                .tooltip("Toolbox")
                .show_menu_on_left_click(false);
            let tray_builder = if let Some(icon) = app.default_window_icon().cloned() { tray_builder.icon(icon) } else { tray_builder };
            let _tray = tray_builder
                    .on_menu_event(|app, event| { if event.id().as_ref() == "quit" { save_main_window(app); app.exit(0); } })
                    .on_tray_icon_event(|tray, event| {
                        if matches!(
                            event,
                            tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, .. }
                                | tauri::tray::TrayIconEvent::DoubleClick { button: MouseButton::Left, .. }
                        ) {
                            if let Some(win) = tray.app_handle().get_webview_window("main") {
                                let _ = win.unminimize();
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                // The tray icon keeps a Tauri process alive after its main window closes.
                // Closing the main window is intentionally an application-wide quit.
                save_main_window(&window.app_handle());
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::SavedWindowState;

    #[test]
    fn saved_window_state_accepts_legacy_files_without_maximized_flag() {
        let state: SavedWindowState = serde_json::from_str(r#"{"x":10,"y":20,"width":900,"height":700}"#).expect("legacy state is valid");
        assert!(!state.maximized);
    }

    #[test]
    fn tray_icon_is_created_only_by_rust_setup() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("valid Tauri config");

        assert!(
            config.pointer("/app/trayIcon").is_none(),
            "app.trayIcon creates a second tray icon without the Rust event handlers"
        );
    }
}
