use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct LoginState(pub Mutex<Option<String>>);

pub fn require_login_cookie(cookie: Option<String>) -> Result<String, String> { cookie.ok_or_else(|| "请先扫码登录后再下载".to_string()) }
pub fn login_cookie(app: &AppHandle) -> Result<String, String> { let cookie = app.state::<LoginState>().0.lock().map_err(|_| "登录状态不可用".to_string())?.clone(); require_login_cookie(cookie) }
pub fn login_cookie_path(app: &AppHandle) -> Result<PathBuf, String> { let dir = app.path().app_data_dir().map_err(|e| e.to_string())?; std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?; Ok(dir.join("ncm_login_cookie.txt")) }
pub fn clear_login_state(state: &LoginState) -> Result<(), String> { *state.0.lock().map_err(|_| "登录状态不可用".to_string())? = None; Ok(()) }
pub fn clear_login_cookie(app: &AppHandle) -> Result<(), String> { clear_login_state(&app.state::<LoginState>())?; let path = login_cookie_path(app)?; if path.exists() { std::fs::remove_file(path).map_err(|e| e.to_string())?; } Ok(()) }
