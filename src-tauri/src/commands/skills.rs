use tauri::AppHandle;

pub use crate::skills::types::{Skill, SkillCategory, SkillCategorySave, SkillMetadataUpdate};

#[tauri::command]
pub fn skills_scan(app: AppHandle) -> Result<Vec<Skill>, String> { crate::skills::service::skills_scan(app) }
#[tauri::command]
pub fn skills_update_metadata(app: AppHandle, update: SkillMetadataUpdate) -> Result<(), String> { crate::skills::service::skills_update_metadata(app, update) }
#[tauri::command]
pub fn skills_list_categories(app: AppHandle) -> Result<Vec<SkillCategory>, String> { crate::skills::service::skills_list_categories(app) }
#[tauri::command]
pub fn skills_save_category(app: AppHandle, category: SkillCategorySave) -> Result<SkillCategory, String> { crate::skills::service::skills_save_category(app, category) }
#[tauri::command]
pub fn skills_delete_category(app: AppHandle, id: i64) -> Result<(), String> { crate::skills::service::skills_delete_category(app, id) }
#[tauri::command]
pub fn skills_delete_skill(app: AppHandle, path: String) -> Result<(), String> { crate::skills::service::skills_delete_skill(app, path) }
