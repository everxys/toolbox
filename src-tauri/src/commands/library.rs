use tauri::AppHandle;

pub use crate::library::types::{ImportResult, LibraryBook, MetadataUpdate};

#[tauri::command]
pub fn library_scan(app: AppHandle) -> Result<Vec<LibraryBook>, String> {
    crate::library::service::library_scan(app)
}

#[tauri::command]
pub fn library_cached(app: AppHandle) -> Result<Vec<LibraryBook>, String> {
    crate::library::service::library_cached(app)
}

#[tauri::command]
pub fn library_update_metadata(app: AppHandle, update: MetadataUpdate) -> Result<(), String> {
    crate::library::service::library_update_metadata(app, update)
}

#[tauri::command]
pub fn library_set_read_status(path: String, read: bool) -> Result<(), String> {
    crate::library::service::library_set_read_status(path, read)
}

#[tauri::command]
pub fn library_open_book(path: String) -> Result<(), String> {
    crate::library::service::library_open_book(path)
}

#[tauri::command]
pub fn library_rename_book(app: AppHandle, path: String, title: String) -> Result<(), String> {
    crate::library::service::library_rename_book(app, path, title)
}

#[tauri::command]
pub fn library_delete_book(app: AppHandle, path: String) -> Result<(), String> {
    crate::library::service::library_delete_book(app, path)
}

#[tauri::command]
pub fn library_import(paths: Vec<String>, read: bool) -> Result<Vec<ImportResult>, String> {
    crate::library::service::library_import(paths, read)
}
