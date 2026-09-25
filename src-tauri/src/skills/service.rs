// Skill implementation; Tauri protocol entry points remain in commands::skills.
use rusqlite::Connection;
use std::{collections::{HashMap, HashSet}, fs};
use tauri::AppHandle;

use super::types::{Skill, SkillCategory, SkillCategorySave, SkillMetadataUpdate};
use super::{filesystem, manifest, repository};

fn db(app: &AppHandle) -> Result<Connection, String> {
    repository::open_database(app)
}

pub fn skills_scan(app: AppHandle) -> Result<Vec<Skill>, String> {
    let root = filesystem::normalized(&filesystem::skills_root()?).map_err(|_| "找不到 ~/.agents 目录，请确认目录存在".to_string())?;
    let dirs = filesystem::discover_skills(&root)?;
    let conn = db(&app)?;
    let descriptions: HashMap<String, String> = {
        let mut statement = conn.prepare("SELECT skill_path, custom_description FROM skill_metadata").map_err(|e| e.to_string())?;
        let result = statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?))).map_err(|e| e.to_string())?
            .collect::<Result<HashMap<_, _>, _>>().map_err(|e| e.to_string())?;
        result
    };
    let memberships: HashMap<String, Vec<i64>> = {
        let mut statement = conn.prepare("SELECT skill_path, category_id FROM skill_category_memberships").map_err(|e| e.to_string())?;
        let mut result: HashMap<String, Vec<i64>> = HashMap::new();
        for row in statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))).map_err(|e| e.to_string())? {
            let (path, id) = row.map_err(|e| e.to_string())?; result.entry(path).or_default().push(id);
        }
        result
    };
    Ok(dirs.into_iter().map(|path| {
        let key = path.to_string_lossy().to_string(); let (name, native_description, parse_error) = manifest::parse_skill_manifest(&path);
        Skill { path: key.clone(), name, native_description, custom_description: descriptions.get(&key).cloned().unwrap_or_default(), parse_error, category_ids: memberships.get(&key).cloned().unwrap_or_default() }
    }).collect())
}

pub fn skills_update_metadata(app: AppHandle, update: SkillMetadataUpdate) -> Result<(), String> {
    let path = filesystem::validate_skill_path(&update.path)?;
    repository::update_metadata(&app, path.to_string_lossy().as_ref(), update.custom_description)
}

pub fn skills_list_categories(app: AppHandle) -> Result<Vec<SkillCategory>, String> {
    repository::list_categories(&app)
}

pub fn skills_save_category(app: AppHandle, category: SkillCategorySave) -> Result<SkillCategory, String> {
    let selected: HashSet<String> = category.skill_paths.iter().map(|path| filesystem::validate_skill_path(path).map(|value| value.to_string_lossy().to_string())).collect::<Result<_, _>>()?;
    repository::save_category(&app, category, selected)
}

pub fn skills_delete_category(app: AppHandle, id: i64) -> Result<(), String> {
    repository::delete_category(&app, id)
}

pub fn skills_delete_skill(app: AppHandle, path: String) -> Result<(), String> {
    let skill = filesystem::validate_skill_path(&path)?;
    fs::remove_dir_all(&skill).map_err(|e| format!("无法删除 skill 目录 {}：{e}", skill.display()))?;
    repository::delete_skill_metadata(&app, skill.to_string_lossy().as_ref())
}

#[cfg(test)]
mod tests {
    use super::manifest::value_from_front_matter;
    #[test] fn front_matter_fields_are_read() { assert_eq!(value_from_front_matter("---\nname: hello\ndescription: 'world'\n---\n", "name"), Some("hello".into())); assert_eq!(value_from_front_matter("# no front matter", "name"), None); }
    #[test] fn block_descriptions_are_decoded() {
        assert_eq!(value_from_front_matter("---\ndescription: >-\n  first line\n  second line\n---\n", "description"), Some("first line second line".into()));
        assert_eq!(value_from_front_matter("---\ndescription: |\n  first line\n  second line\n---\n", "description"), Some("first line\nsecond line".into()));
    }
}
