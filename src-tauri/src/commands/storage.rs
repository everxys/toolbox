pub use crate::storage::{DatabaseLocation, DatabaseSwitchResult};
use tauri::AppHandle;

#[tauri::command]
pub fn database_location(app: AppHandle) -> Result<DatabaseLocation, String> {
    crate::storage::database_location(app)
}

#[tauri::command]
pub fn database_migrate(app: AppHandle, directory: String) -> Result<DatabaseLocation, String> {
    crate::storage::database_migrate(app, directory)
}

#[tauri::command]
pub fn database_use_existing(app: AppHandle, path: String) -> Result<DatabaseSwitchResult, String> {
    crate::storage::database_use_existing(app, path)
}
