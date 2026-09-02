use serde::Serialize;
use std::time::{Duration, Instant};

#[derive(Serialize, Clone)]
pub struct VpnCheckResult {
    pub ok: bool,
    pub latency_ms: Option<u64>,
    pub status: Option<u16>,
    pub error: Option<String>,
    pub checked_at: String,
}

fn now_iso() -> String {
    // 简单 ISO 时间，避免 chrono 依赖
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // 返回秒级时间戳字符串，前端自行格式化
    secs.to_string()
}

fn shared_client() -> &'static reqwest::Client {
    // 复用 ncm.rs 的单例，避免重复建池；若 ncm 未初始化则回退新建
    // 这里直接新建轻量 client，带短超时
    use std::sync::OnceLock;
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .connect_timeout(Duration::from_secs(5))
            .pool_idle_timeout(Duration::from_secs(60))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36")
            .build()
            .expect("vpn client")
    })
}

#[tauri::command]
pub async fn vpn_check_google() -> Result<VpnCheckResult, String> {
    let client = shared_client();
    let start = Instant::now();
    // 用 HEAD 优先，失败回退 GET；google.com 对 HEAD 友好
    let try_head = client
        .head("https://www.google.com/generate_204")
        .header("Cache-Control", "no-cache")
        .send()
        .await;
    let resp = match try_head {
        Ok(r) if r.status().is_success() || r.status().as_u16() == 204 => Ok(r),
        _ => {
            client
                .get("https://www.google.com/")
                .header("Cache-Control", "no-cache")
                .send()
                .await
                .map_err(|e| e.to_string())
        }
    };
    match resp {
        Ok(r) => {
            let status = r.status().as_u16();
            let ok = (200..400).contains(&status) || status == 204;
            let latency = start.elapsed().as_millis() as u64;
            Ok(VpnCheckResult {
                ok,
                latency_ms: Some(latency),
                status: Some(status),
                error: if ok { None } else { Some(format!("HTTP {status}")) },
                checked_at: now_iso(),
            })
        }
        Err(e) => Ok(VpnCheckResult {
            ok: false,
            latency_ms: None,
            status: None,
            error: Some(e.to_string()),
            checked_at: now_iso(),
        }),
    }
}

fn is_monitor_visible(app: &tauri::AppHandle) -> bool {
    use tauri::Manager;
    app.get_webview_window("vpn-monitor")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

pub fn sync_tray_menu(app: &tauri::AppHandle) {
    use tauri::{
        menu::{MenuBuilder, MenuItemBuilder},
        Manager,
    };
    let visible = is_monitor_visible(app);
    let label = if visible { "关闭监控栏" } else { "打开监控栏" };
    // 重建托盘菜单以切换文案
    let tray = app.tray_by_id("toolbox-tray");
    if let Some(tray) = tray {
        if let Ok(monitor_item) = MenuItemBuilder::with_id("monitor", label).build(app) {
            if let Ok(quit_item) = MenuItemBuilder::with_id("quit", "退出 Toolbox").build(app) {
                if let Ok(menu) = MenuBuilder::new(app).items(&[&monitor_item, &quit_item]).build() {
                    let _ = tray.set_menu(Some(menu));
                    let _ = tray.set_tooltip(Some(if visible {
                        "Toolbox - 监控栏已打开"
                    } else {
                        "Toolbox - VPN 监控"
                    }));
                }
            }
        }
    }
}

#[tauri::command]
pub async fn vpn_open_monitor_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("vpn-monitor") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        win.set_always_on_top(true).map_err(|e| e.to_string())?;
        sync_tray_menu(&app);
        return Ok(());
    }
    // 动态创建悬浮窗（若 tauri.conf 未预定义则兜底创建）
    let url = tauri::WebviewUrl::App("index.html?monitor=1".into());
    let win = tauri::WebviewWindowBuilder::new(&app, "vpn-monitor", url)
        .title("VPN 监控")
        .inner_size(340.0, 140.0)
        .min_inner_size(300.0, 110.0)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;
    win.set_always_on_top(true).map_err(|e| e.to_string())?;
    sync_tray_menu(&app);
    Ok(())
}

#[tauri::command]
pub async fn vpn_close_monitor_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("vpn-monitor") {
        win.hide().map_err(|e| e.to_string())?;
    }
    sync_tray_menu(&app);
    Ok(())
}

#[tauri::command]
pub async fn vpn_toggle_monitor_window(app: tauri::AppHandle) -> Result<bool, String> {
    if is_monitor_visible(&app) {
        vpn_close_monitor_window(app.clone()).await?;
        Ok(false)
    } else {
        vpn_open_monitor_window(app.clone()).await?;
        Ok(true)
    }
}

#[tauri::command]
pub fn vpn_quit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}
