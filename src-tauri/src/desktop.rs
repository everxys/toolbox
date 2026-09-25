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

pub(crate) fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{MenuBuilder, MenuItemBuilder},
        tray::{MouseButton, TrayIconBuilder},
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
}

pub(crate) fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if window.label() == "main" && matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
        // The tray icon keeps a Tauri process alive after its main window closes.
        // Closing the main window is intentionally an application-wide quit.
        save_main_window(&window.app_handle());
        window.app_handle().exit(0);
    }
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
