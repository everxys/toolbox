use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use rusqlite::{params, Connection};

// 复用 open-orpheus 的 cookie 思想：deviceId / appver 注入
// 这里简化：直接用 reqwest 带上 MUSIC_U

#[derive(Default)]
pub struct LoginState(pub Mutex<Option<String>>);

fn ncm_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(Duration::from_secs(90))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36")
            .build()
            .expect("reqwest client")
    })
}

fn require_login_cookie(cookie: Option<String>) -> Result<String, String> {
    cookie.ok_or_else(|| "请先扫码登录后再下载".to_string())
}

fn login_cookie(app: &AppHandle) -> Result<String, String> {
    let cookie = app
        .state::<LoginState>()
        .0
        .lock()
        .map_err(|_| "登录状态不可用".to_string())?
        .clone();
    require_login_cookie(cookie)
}

fn login_cookie_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("ncm_login_cookie.txt"))
}

fn download_db(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let connection = Connection::open(dir.join("toolbox.db")).map_err(|e| e.to_string())?;
    connection.execute(
        "CREATE TABLE IF NOT EXISTS ncm_downloads (song_id INTEGER PRIMARY KEY, file_path TEXT, downloaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(connection)
}

fn record_download(app: &AppHandle, id: i64, path: Option<&str>) -> Result<(), String> {
    download_db(app)?.execute(
        "INSERT INTO ncm_downloads (song_id, file_path) VALUES (?1, ?2) ON CONFLICT(song_id) DO UPDATE SET file_path = COALESCE(excluded.file_path, ncm_downloads.file_path), downloaded_at = CURRENT_TIMESTAMP",
        params![id, path],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn ncm_list_downloaded(app: AppHandle) -> Result<Vec<i64>, String> {
    let connection = download_db(&app)?;
    let mut statement = connection.prepare("SELECT song_id FROM ncm_downloads").map_err(|e| e.to_string())?;
    let rows = statement.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?;
    let ids = rows.collect::<Result<Vec<i64>, _>>().map_err(|e| e.to_string())?;
    Ok(ids)
}

#[tauri::command]
pub fn ncm_mark_downloaded(app: AppHandle, id: i64) -> Result<(), String> {
    record_download(&app, id, None)
}

#[tauri::command]
pub fn ncm_mark_downloaded_many(app: AppHandle, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    let mut connection = download_db(&app)?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    {
        let mut statement = tx
            .prepare("INSERT INTO ncm_downloads (song_id, file_path) VALUES (?1, ?2) ON CONFLICT(song_id) DO UPDATE SET file_path = COALESCE(excluded.file_path, ncm_downloads.file_path), downloaded_at = CURRENT_TIMESTAMP")
            .map_err(|e| e.to_string())?;
        for id in &ids {
            statement
                .execute(params![id, Option::<String>::None])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn nickname_from_login_status(value: &serde_json::Value) -> Option<String> {
    value["profile"]["nickname"].as_str().map(str::to_owned)
}

fn qr_check_path(unikey: &str) -> String {
    format!("/api/login/qrcode/client/login?key={unikey}&type=1")
}

fn extract_music_u_cookie(headers: &[&str]) -> Option<String> {
    headers
        .iter()
        .map(|header| header.split(';').next().unwrap_or_default().trim())
        .find(|cookie| cookie.starts_with("MUSIC_U="))
        .map(str::to_owned)
}

fn safe_file_part(value: &str) -> String {
    let value = value
        .chars()
        .map(|ch| if matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') { '_' } else { ch })
        .collect::<String>();
    let value = value.trim_matches(|ch: char| ch == '.' || ch.is_whitespace());
    if value.is_empty() { "未知".into() } else { value.into() }
}

fn download_file_name(name: &str, artists: &[String], url: &str) -> String {
    let extension = url
        .split('?')
        .next()
        .and_then(|path| path.rsplit('.').next())
        .filter(|ext| (1..=5).contains(&ext.len()) && ext.chars().all(|ch| ch.is_ascii_alphanumeric()))
        .unwrap_or("mp3");
    let artist = artists.join("、");
    format!("{} - {}.{}", safe_file_part(name), safe_file_part(&artist), extension)
}

fn ensure_audio_response(status: u16, content_type: Option<&str>) -> Result<(), String> {
    if !(200..300).contains(&status) {
        return Err(format!("音频下载失败（CDN HTTP {status}）"));
    }
    if content_type.is_some_and(|value| value.to_ascii_lowercase().contains("text/html")) {
        return Err("音频下载失败：CDN 返回了网页而不是音频".into());
    }
    Ok(())
}

fn player_cookie(cookie: &str) -> String {
    let mut cookie = cookie.to_string();
    if !cookie.split(';').any(|part| part.trim_start().starts_with("os=")) {
        cookie.push_str("; os=pc");
    }
    if !cookie.split(';').any(|part| part.trim_start().starts_with("appver=")) {
        cookie.push_str("; appver=2.7.1.198277");
    }
    cookie
}

fn clear_login_state(state: &LoginState) -> Result<(), String> {
    *state.0.lock().map_err(|_| "登录状态不可用".to_string())? = None;
    Ok(())
}

fn clear_login_cookie(app: &AppHandle) -> Result<(), String> {
    clear_login_state(&app.state::<LoginState>())?;

    let path = login_cookie_path(app)?;
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Serialize)]
pub struct QrCreateResp {
    pub unikey: String,
    #[serde(rename = "qrUrl")]
    pub qr_url: String,
}

#[cfg(test)]
mod tests {
    use super::{clear_login_state, download_file_name, ensure_audio_response, extract_music_u_cookie, nickname_from_login_status, player_cookie, qr_check_path, require_login_cookie, LoginState, QrCreateResp};
    use std::sync::Mutex;

    #[test]
    fn qr_create_response_uses_camel_case_url_key() {
        let response = QrCreateResp {
            unikey: "test-key".into(),
            qr_url: "https://example.com/qr".into(),
        };

        let value = serde_json::to_value(response).unwrap();
        assert_eq!(value["qrUrl"], "https://example.com/qr");
    }

    #[test]
    fn download_requires_a_login_cookie() {
        assert!(require_login_cookie(None).is_err());
    }

    #[test]
    fn login_status_reads_the_account_nickname() {
        let response = serde_json::json!({
            "profile": { "nickname": "everx" }
        });

        assert_eq!(nickname_from_login_status(&response), Some("everx".into()));
    }

    #[test]
    fn logout_clears_the_in_memory_cookie() {
        let state = LoginState(Mutex::new(Some("MUSIC_U=active".into())));

        clear_login_state(&state).unwrap();

        assert!(state.0.lock().unwrap().is_none());
    }

    #[test]
    fn qr_check_uses_the_client_login_endpoint() {
        assert_eq!(
            qr_check_path("test-key"),
            "/api/login/qrcode/client/login?key=test-key&type=1"
        );
    }

    #[test]
    fn qr_login_uses_music_u_from_multiple_set_cookie_headers() {
        let headers = [
            "NMTID=not-a-login-cookie; Path=/",
            "MUSIC_U=valid-login-cookie; Path=/; HttpOnly",
        ];

        assert_eq!(extract_music_u_cookie(&headers), Some("MUSIC_U=valid-login-cookie".into()));
    }

    #[test]
    fn download_file_name_uses_song_artist_and_real_extension() {
        assert_eq!(
            download_file_name("Song/Name", &["A:rtist".into()], "https://cdn.example.com/audio.flac?token=1"),
            "Song_Name - A_rtist.flac"
        );
    }

    #[test]
    fn download_rejects_cdn_html_error_pages() {
        assert!(ensure_audio_response(403, Some("text/html")).is_err());
    }

    #[test]
    fn player_cookie_includes_the_pc_client_identity() {
        assert_eq!(
            player_cookie("MUSIC_U=token"),
            "MUSIC_U=token; os=pc; appver=2.7.1.198277"
        );
    }
}

#[tauri::command]
pub async fn ncm_qr_create(_app: AppHandle) -> Result<QrCreateResp, String> {
    // 调用 weapi/login/qrcode/unikey (无需加密的公开端点亦可)
    let resp = ncm_client().get("https://music.163.com/api/login/qrcode/unikey?type=1")
        .header("Referer", "https://music.163.com/")
        .send().await.map_err(|e| e.to_string())?;
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let unikey = j.get("unikey").or(j.get("data").and_then(|d| d.get("unikey")))
        .and_then(|v| v.as_str()).ok_or("no unikey")?.to_string();
    Ok(QrCreateResp{ qr_url: format!("https://music.163.com/login?codekey={}", unikey), unikey })
}

#[derive(Serialize)]
pub struct QrCheckResp { pub code: i32, pub cookie: Option<String>, pub message: String }

#[tauri::command]
pub async fn ncm_qr_check(unikey: String) -> Result<QrCheckResp, String> {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let url = format!("https://music.163.com{}&_={ts}", qr_check_path(&unikey));
    let resp = ncm_client().get(&url).header("Referer","https://music.163.com/").send().await.map_err(|e| e.to_string())?;
    let headers = resp.headers().clone();
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let code = j.get("code").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    // 803 时从全部 Set-Cookie 中选择真正的登录凭证，而非可能排在第一位的 NMTID。
    let set_cookies = headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .collect::<Vec<_>>();
    let cookie = extract_music_u_cookie(&set_cookies);
    let message = j.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string();
    Ok(QrCheckResp{ code, cookie, message })
}

#[tauri::command]
pub fn ncm_set_login_cookie(app: AppHandle, state: tauri::State<'_, LoginState>, cookie: String) -> Result<(), String> {
    if cookie.trim().is_empty() {
        return Err("登录未返回有效 Cookie，请刷新二维码后重试".into());
    }
    let cookie = cookie.trim().to_string();
    std::fs::write(login_cookie_path(&app)?, &cookie).map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|_| "登录状态不可用".to_string())? = Some(cookie);
    Ok(())
}

#[tauri::command]
pub fn ncm_logout(app: AppHandle) -> Result<(), String> {
    clear_login_cookie(&app)
}

#[derive(Serialize)]
pub struct LoginStatusResp {
    pub nickname: Option<String>,
}

#[tauri::command]
pub async fn ncm_login_status(app: AppHandle) -> Result<LoginStatusResp, String> {
    let cookie = match login_cookie(&app) {
        Ok(cookie) => cookie,
        Err(_) => {
            let app_for_path = app.clone();
            let path = tokio::task::spawn_blocking(move || login_cookie_path(&app_for_path))
                .await
                .map_err(|e| e.to_string())?
                .map_err(|e| e.to_string())?;
            let content = tokio::fs::read_to_string(&path).await.unwrap_or_default();
            if content.trim().is_empty() {
                return Ok(LoginStatusResp { nickname: None });
            }
            let cookie = content.trim().to_string();
            *app.state::<LoginState>()
                .0
                .lock()
                .map_err(|_| "登录状态不可用".to_string())? = Some(cookie.clone());
            cookie
        }
    };

    let response = ncm_client()
        .get("https://music.163.com/api/nuser/account/get")
        .header("Referer", "https://music.163.com/")
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let value: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let nickname = nickname_from_login_status(&value);
    if nickname.is_none() {
        let app_clone = app.clone();
        tokio::task::spawn_blocking(move || clear_login_cookie(&app_clone))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;
    }
    Ok(LoginStatusResp { nickname })
}

#[tauri::command]
pub fn ncm_open_download_dir(app: AppHandle) -> Result<(), String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct PlaylistDetail { pub info: PlaylistInfo, pub trackIds: Vec<TrackId> }
#[derive(Serialize, Deserialize)]
pub struct PlaylistInfo { pub id: i64, pub name: String, pub creator: String, pub trackCount: i32, pub playCount: i64, pub coverUrl: String }
#[derive(Serialize, Deserialize)]
pub struct TrackId { pub id: i64, pub v: i32 }

#[tauri::command]
pub async fn ncm_playlist_detail(id: i64) -> Result<PlaylistDetail, String> {
    let url = format!("https://music.163.com/api/v6/playlist/detail?id={}", id);
    let resp = ncm_client().get(&url).header("Referer","https://music.163.com/").send().await.map_err(|e| e.to_string())?;
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let pl = &j["playlist"];
    Ok(PlaylistDetail{
        info: PlaylistInfo{
            id: pl["id"].as_i64().unwrap_or(id),
            name: pl["name"].as_str().unwrap_or("").to_string(),
            creator: pl["creator"]["nickname"].as_str().unwrap_or("").to_string(),
            trackCount: pl["trackCount"].as_i64().unwrap_or(0) as i32,
            playCount: pl["playCount"].as_i64().unwrap_or(0),
            coverUrl: pl["coverImgUrl"].as_str().unwrap_or("").to_string(),
        },
        trackIds: serde_json::from_value(pl["trackIds"].clone()).map_err(|e| e.to_string())?,
    })
}

#[derive(Serialize)]
pub struct Track { pub id: i64, pub v: i32, pub name: String, pub artists: Vec<String>, pub album: String, pub duration: i64 }

#[tauri::command]
pub async fn ncm_song_detail(ids: Vec<i64>) -> Result<Vec<Track>, String> {
    let ids_str = ids.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",");
    let url = format!("https://music.163.com/api/song/detail?ids=[{}]", ids_str);
    let resp = ncm_client().get(&url).header("Referer","https://music.163.com/").send().await.map_err(|e| e.to_string())?;
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    if let Some(arr) = j["songs"].as_array() {
        for s in arr {
            out.push(Track{
                id: s["id"].as_i64().unwrap_or(0),
                v: 0,
                name: s["name"].as_str().unwrap_or("").to_string(),
                artists: s["artists"].as_array().or(s["ar"].as_array()).map(|a| a.iter().filter_map(|x| x["name"].as_str().map(|s| s.to_string())).collect()).unwrap_or_default(),
                album: s["album"]["name"].as_str().or(s["al"]["name"].as_str()).unwrap_or("").to_string(),
                duration: s["duration"].as_i64().or(s["dt"].as_i64()).unwrap_or(0),
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn ncm_player_url(app: AppHandle, id: i64, level: Option<String>) -> Result<serde_json::Value, String> {
    let level = level.unwrap_or("standard".into());
    let cookie = login_cookie(&app)?;
    let cookie = player_cookie(&cookie);
    let url = format!("https://music.163.com/api/song/enhance/player/url/v1?ids=[{}]&level={}&encodeType=mp3", id, level);
    let resp = ncm_client().get(&url).header("Referer","https://music.163.com/").header("Cookie", cookie).send().await.map_err(|e| e.to_string())?;
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let url_opt = j["data"].as_array().and_then(|a| a.get(0)).and_then(|d| d["url"].as_str()).map(|s| s.to_string());
    Ok(serde_json::json!({"url": url_opt}))
}

#[tauri::command]
pub async fn ncm_download(app: AppHandle, id: i64, name: String, artists: Vec<String>, level: Option<String>) -> Result<serde_json::Value, String> {
    let v = ncm_player_url(app.clone(), id, level).await?;
    let url = v["url"].as_str().ok_or("no url - 可能是VIP/需登录")?.to_string();
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let path = dir.join(download_file_name(&name, &artists, &url));
    let response = ncm_client()
        .get(&url)
        .header("Referer", "https://music.163.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_owned());
    ensure_audio_response(status, content_type.as_deref())?;
    let mut file = tokio::fs::File::create(&path).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    {
        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;
        while let Some(chunk) = stream.next().await {
            let bytes = chunk.map_err(|e| e.to_string())?;
            file.write_all(&bytes).await.map_err(|e| e.to_string())?;
        }
        file.flush().await.map_err(|e| e.to_string())?;
    }
    let file_path = path.to_string_lossy().to_string();
    let app_for_db = app.clone();
    tokio::task::spawn_blocking(move || record_download(&app_for_db, id, Some(&file_path)))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"filePath": path.to_string_lossy()}))
}
