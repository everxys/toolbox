use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// 复用 open-orpheus 的 cookie 思想：deviceId / appver 注入
// 这里简化：直接用 reqwest 带上 MUSIC_U

#[derive(Serialize)]
pub struct QrCreateResp { pub unikey: String, pub qr_url: String }

#[tauri::command]
pub async fn ncm_qr_create(app: AppHandle) -> Result<QrCreateResp, String> {
    // 调用 weapi/login/qrcode/unikey (无需加密的公开端点亦可)
    let client = reqwest::Client::new();
    let resp = client.get("https://music.163.com/api/login/qrcode/unikey?type=1")
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
    let client = reqwest::Client::new();
    let url = format!("https://music.163.com/api/login/qrcode/check?key={}&type=1&_={}", unikey, chrono::Utc::now().timestamp_millis());
    let resp = client.get(&url).header("Referer","https://music.163.com/").send().await.map_err(|e| e.to_string())?;
    let headers = resp.headers().clone();
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let code = j.get("code").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    // 803 时 set-cookie 里有 MUSIC_U，存到 tauri cookie store
    let cookie = headers.get("set-cookie").and_then(|v| v.to_str().ok()).map(|s| s.to_string());
    let message = j.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string();
    Ok(QrCheckResp{ code, cookie, message })
}

#[derive(Serialize, Deserialize)]
pub struct PlaylistDetail { pub info: PlaylistInfo, pub trackIds: Vec<TrackId> }
#[derive(Serialize, Deserialize)]
pub struct PlaylistInfo { pub id: i64, pub name: String, pub creator: String, pub trackCount: i32, pub playCount: i64, pub coverUrl: String }
#[derive(Serialize, Deserialize)]
pub struct TrackId { pub id: i64, pub v: i32 }

#[tauri::command]
pub async fn ncm_playlist_detail(id: i64) -> Result<PlaylistDetail, String> {
    let client = reqwest::Client::new();
    let url = format!("https://music.163.com/api/v6/playlist/detail?id={}", id);
    let resp = client.get(&url).header("Referer","https://music.163.com/").send().await.map_err(|e| e.to_string())?;
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
    let client = reqwest::Client::new();
    let ids_str = ids.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",");
    let url = format!("https://music.163.com/api/song/detail?ids=[{}]", ids_str);
    let resp = client.get(&url).header("Referer","https://music.163.com/").send().await.map_err(|e| e.to_string())?;
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
    // 需要 MUSIC_U，从 tauri store 取（示例直接无鉴权请求，能拿 128k 试听）
    let client = reqwest::Client::new();
    let url = format!("https://music.163.com/api/song/enhance/player/url/v1?ids=[{}]&level={}&encodeType=mp3", id, level);
    let resp = client.get(&url).header("Referer","https://music.163.com/").send().await.map_err(|e| e.to_string())?;
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let url_opt = j["data"].as_array().and_then(|a| a.get(0)).and_then(|d| d["url"].as_str()).map(|s| s.to_string());
    Ok(serde_json::json!({"url": url_opt}))
}

#[tauri::command]
pub async fn ncm_download(app: AppHandle, id: i64, level: Option<String>) -> Result<serde_json::Value, String> {
    let v = ncm_player_url(app.clone(), id, level).await?;
    let url = v["url"].as_str().ok_or("no url - 可能是VIP/需登录")?.to_string();
    // 下载到 app_data
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.mp3", id));
    let bytes = reqwest::get(&url).await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    // 写入 sqlite 已下载
    Ok(serde_json::json!({"filePath": path.to_string_lossy()}))
}
