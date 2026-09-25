use tauri::{AppHandle, State};
pub use crate::ncm::service::{LoginState, LoginStatusResp, PlaylistDetail, QrCheckResp, QrCreateResp, Track};
#[tauri::command] pub fn ncm_list_downloaded(app: AppHandle) -> Result<Vec<i64>, String> { crate::ncm::service::ncm_list_downloaded(app) }
#[tauri::command] pub fn ncm_mark_downloaded(app: AppHandle, id: i64) -> Result<(), String> { crate::ncm::service::ncm_mark_downloaded(app, id) }
#[tauri::command] pub fn ncm_mark_downloaded_many(app: AppHandle, ids: Vec<i64>) -> Result<(), String> { crate::ncm::service::ncm_mark_downloaded_many(app, ids) }
#[tauri::command] pub async fn ncm_qr_create(app: AppHandle) -> Result<QrCreateResp, String> { crate::ncm::service::ncm_qr_create(app).await }
#[tauri::command] pub async fn ncm_qr_check(unikey: String) -> Result<QrCheckResp, String> { crate::ncm::service::ncm_qr_check(unikey).await }
#[tauri::command] pub fn ncm_set_login_cookie(app: AppHandle, state: State<'_, LoginState>, cookie: String) -> Result<(), String> { crate::ncm::service::ncm_set_login_cookie(app, state, cookie) }
#[tauri::command] pub fn ncm_logout(app: AppHandle) -> Result<(), String> { crate::ncm::service::ncm_logout(app) }
#[tauri::command] pub async fn ncm_login_status(app: AppHandle) -> Result<LoginStatusResp, String> { crate::ncm::service::ncm_login_status(app).await }
#[tauri::command] pub fn ncm_open_download_dir(app: AppHandle) -> Result<(), String> { crate::ncm::service::ncm_open_download_dir(app) }
#[tauri::command] pub async fn ncm_playlist_detail(id: i64) -> Result<PlaylistDetail, String> { crate::ncm::service::ncm_playlist_detail(id).await }
#[tauri::command] pub async fn ncm_song_detail(ids: Vec<i64>) -> Result<Vec<Track>, String> { crate::ncm::service::ncm_song_detail(ids).await }
#[tauri::command] pub async fn ncm_player_url(app: AppHandle, id: i64, level: Option<String>) -> Result<serde_json::Value, String> { crate::ncm::service::ncm_player_url(app, id, level).await }
#[tauri::command] pub async fn ncm_download(app: AppHandle, id: i64, name: String, artists: Vec<String>, level: Option<String>) -> Result<serde_json::Value, String> { crate::ncm::service::ncm_download(app, id, name, artists, level).await }
