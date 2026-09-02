#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
use commands::{ncm, vpn};

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
            vpn::vpn_check_google,
            vpn::vpn_open_monitor_window,
            vpn::vpn_close_monitor_window,
            vpn::vpn_toggle_monitor_window,
            vpn::vpn_quit_app
        ])
        .setup(|app| {
            use tauri::{
                menu::{MenuBuilder, MenuItemBuilder},
                tray::{MouseButton, TrayIconBuilder},
                Manager,
            };
            let quit_item = MenuItemBuilder::with_id("quit", "退出 Toolbox").build(app)?;
            let monitor_item = MenuItemBuilder::with_id("monitor", "打开监控栏").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&monitor_item, &quit_item]).build()?;
            let tray_builder = TrayIconBuilder::with_id("toolbox-tray")
                .menu(&menu)
                .tooltip("Toolbox - VPN 监控")
                .show_menu_on_left_click(false);
            let _tray = if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder
                    .icon(icon)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "quit" => app.exit(0),
                        "monitor" => {
                            let handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = vpn::vpn_toggle_monitor_window(handle).await;
                            });
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                            if let Some(win) = tray.app_handle().get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(app)?
            } else {
                tray_builder
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "quit" => app.exit(0),
                        "monitor" => {
                            let handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = vpn::vpn_toggle_monitor_window(handle).await;
                            });
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                            if let Some(win) = tray.app_handle().get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(app)?
            };
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
