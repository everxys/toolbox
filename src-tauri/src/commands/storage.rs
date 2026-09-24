use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

const DATABASE_FILE_NAME: &str = "toolbox.db";
const SETTINGS_FILE_NAME: &str = "toolbox-settings.json";

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageSettings {
    database_directory: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseLocation {
    pub directory: String,
    pub database_path: String,
    pub is_default: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseSwitchResult {
    pub location: DatabaseLocation,
    pub backup_path: Option<String>,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(SETTINGS_FILE_NAME))
}

fn read_settings(app: &AppHandle) -> Result<StorageSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() { return Ok(StorageSettings::default()); }
    let contents = fs::read(&path).map_err(|error| format!("无法读取数据库设置：{error}"))?;
    serde_json::from_slice(&contents).map_err(|error| format!("数据库设置文件无效：{error}"))
}

fn write_settings(app: &AppHandle, settings: &StorageSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let temporary = path.with_extension("json.tmp");
    let contents = serde_json::to_vec_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(&temporary, contents).map_err(|error| format!("无法保存数据库设置：{error}"))?;
    if path.exists() { fs::remove_file(&path).map_err(|error| format!("无法替换数据库设置：{error}"))?; }
    fs::rename(&temporary, &path).map_err(|error| format!("无法启用新的数据库设置：{error}"))
}

fn configured_directory(app: &AppHandle) -> Result<(PathBuf, bool), String> {
    let default_directory = app_data_dir(app)?;
    match read_settings(app)?.database_directory {
        Some(directory) => {
            let directory = PathBuf::from(directory);
            if !directory.is_absolute() { return Err("数据库保存位置必须是绝对路径".into()); }
            Ok((directory, false))
        }
        None => Ok((default_directory, true)),
    }
}

pub fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(configured_directory(app)?.0.join(DATABASE_FILE_NAME))
}

pub fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let parent = path.parent().ok_or("数据库保存位置无效")?;
    fs::create_dir_all(parent).map_err(|error| format!("无法创建数据库保存目录：{error}"))?;
    Connection::open(path).map_err(|error| error.to_string())
}

fn validate_database(path: &Path) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| format!("无法打开迁移后的数据库：{error}"))?;
    let check: String = connection.query_row("PRAGMA integrity_check", [], |row| row.get(0)).map_err(|error| format!("无法验证迁移后的数据库：{error}"))?;
    if check != "ok" { return Err(format!("迁移后的数据库完整性检查失败：{check}")); }
    Ok(())
}

fn backup_database(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() { return Ok(None); }
    let parent = path.parent().ok_or("当前数据库路径无效")?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let backup = parent.join(format!("toolbox.backup-{stamp}.db"));
    fs::copy(path, &backup).map_err(|error| format!("无法备份当前数据库：{error}"))?;
    if let Err(error) = validate_database(&backup) {
        let _ = fs::remove_file(&backup);
        return Err(error);
    }
    Ok(Some(backup))
}

#[tauri::command]
pub fn database_location(app: AppHandle) -> Result<DatabaseLocation, String> {
    let (directory, is_default) = configured_directory(&app)?;
    let database_path = directory.join(DATABASE_FILE_NAME);
    Ok(DatabaseLocation { directory: directory.to_string_lossy().to_string(), database_path: database_path.to_string_lossy().to_string(), is_default })
}

#[tauri::command]
pub fn database_migrate(app: AppHandle, directory: String) -> Result<DatabaseLocation, String> {
    let destination_directory = PathBuf::from(directory.trim());
    if destination_directory.as_os_str().is_empty() || !destination_directory.is_absolute() { return Err("请选择有效的本地文件夹".into()); }
    fs::create_dir_all(&destination_directory).map_err(|error| format!("无法创建目标文件夹：{error}"))?;
    let destination = destination_directory.join(DATABASE_FILE_NAME);
    let source = database_path(&app)?;
    if source == destination { return database_location(app); }
    if destination.exists() { return Err(format!("目标文件夹已包含 {DATABASE_FILE_NAME}，为避免覆盖已有数据，未执行迁移")); }

    if !source.exists() { let _ = open_database(&app)?; }
    let temporary = destination_directory.join(format!(".{DATABASE_FILE_NAME}.migrating"));
    if temporary.exists() { return Err("目标文件夹存在未完成的迁移临时文件，请检查后重试".into()); }
    fs::copy(&source, &temporary).map_err(|error| format!("复制数据库失败：{error}"))?;
    if let Err(error) = validate_database(&temporary) { let _ = fs::remove_file(&temporary); return Err(error); }
    fs::rename(&temporary, &destination).map_err(|error| format!("无法完成数据库迁移：{error}"))?;
    let settings = StorageSettings { database_directory: Some(destination_directory.to_string_lossy().to_string()) };
    if let Err(error) = write_settings(&app, &settings) {
        let _ = fs::remove_file(&destination);
        return Err(error);
    }
    database_location(app)
}

#[tauri::command]
pub fn database_use_existing(app: AppHandle, path: String) -> Result<DatabaseSwitchResult, String> {
    let selected = PathBuf::from(path.trim());
    if !selected.is_absolute() || !selected.is_file() { return Err("请选择一个已有的数据库文件".into()); }
    if selected.file_name().and_then(|name| name.to_str()) != Some(DATABASE_FILE_NAME) {
        return Err(format!("请选择名为 {DATABASE_FILE_NAME} 的数据库文件"));
    }
    validate_database(&selected)?;
    let current = database_path(&app)?;
    if current == selected {
        return Ok(DatabaseSwitchResult { location: database_location(app)?, backup_path: None });
    }
    let backup_path = backup_database(&current)?.map(|path| path.to_string_lossy().to_string());
    let directory = selected.parent().ok_or("所选数据库路径无效")?;
    let settings = StorageSettings { database_directory: Some(directory.to_string_lossy().to_string()) };
    if let Err(error) = write_settings(&app, &settings) {
        if let Some(backup) = backup_path.as_deref() { let _ = fs::remove_file(backup); }
        return Err(error);
    }
    Ok(DatabaseSwitchResult { location: database_location(app)?, backup_path })
}

#[cfg(test)]
mod tests {
    use super::DATABASE_FILE_NAME;
    use std::path::Path;

    #[test]
    fn database_name_is_fixed_inside_the_selected_directory() {
        assert_eq!(Path::new("D:/Toolbox data").join(DATABASE_FILE_NAME), Path::new("D:/Toolbox data/toolbox.db"));
    }
}
