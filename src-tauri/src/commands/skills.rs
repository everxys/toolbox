use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub path: String,
    pub name: String,
    pub native_description: String,
    pub custom_description: String,
    pub parse_error: Option<String>,
    pub category_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCategory { pub id: i64, pub name: String, pub skill_paths: Vec<String> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMetadataUpdate { pub path: String, pub custom_description: String }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCategorySave { pub id: Option<i64>, pub name: String, pub skill_paths: Vec<String> }

fn skills_root() -> Result<PathBuf, String> {
    std::env::var_os("USERPROFILE").map(PathBuf::from).map(|home| home.join(".agents"))
        .ok_or_else(|| "无法确定当前用户的主目录（缺少 USERPROFILE）".into())
}

fn normalized(path: &Path) -> Result<PathBuf, String> { fs::canonicalize(path).map_err(|e| format!("无法解析路径 {}：{e}", path.display())) }

fn db(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("toolbox.db")).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS skill_metadata (skill_path TEXT PRIMARY KEY, custom_description TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
         CREATE TABLE IF NOT EXISTS skill_categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
         CREATE TABLE IF NOT EXISTS skill_category_memberships (category_id INTEGER NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE, skill_path TEXT NOT NULL, PRIMARY KEY(category_id, skill_path));"
    ).map_err(|e| e.to_string())?;
    Ok(conn)
}

fn value_from_front_matter(contents: &str, key: &str) -> Option<String> {
    let lines: Vec<&str> = contents.lines().collect();
    if lines.first()?.trim() != "---" { return None; }
    let prefix = format!("{key}:");
    for (index, line) in lines.iter().enumerate().skip(1) {
        let trimmed = line.trim();
        if trimmed == "---" { break; }
        let Some(value) = trimmed.strip_prefix(&prefix) else { continue; };
        let value = value.trim();
        if !matches!(value, ">" | ">-" | "|" | "|-") {
            return Some(value.trim_matches(['\'', '"']).to_string());
        }

        let mut block = vec![];
        for next in lines.iter().skip(index + 1) {
            if next.trim() == "---" { break; }
            if !next.trim().is_empty() && !next.starts_with(char::is_whitespace) { break; }
            block.push(*next);
        }
        let indent = block.iter().filter(|line| !line.trim().is_empty()).map(|line| line.len() - line.trim_start().len()).min().unwrap_or(0);
        let block: Vec<&str> = block.iter().map(|line| line.get(indent..).unwrap_or("")).collect();
        if value.starts_with('>') {
            let mut output = String::new();
            for line in block {
                if line.trim().is_empty() {
                    if !output.ends_with('\n') { output.push('\n'); }
                } else {
                    if !output.is_empty() && !output.ends_with('\n') { output.push(' '); }
                    output.push_str(line.trim());
                }
            }
            return Some(output.trim().to_string());
        }
        return Some(block.join("\n").trim().to_string());
    }
    None
}

fn parse_skill_manifest(path: &Path) -> (String, String, Option<String>) {
    let fallback = path.file_name().and_then(|part| part.to_str()).unwrap_or("未命名 skill").to_string();
    match fs::read_to_string(path.join("SKILL.md")) {
        Ok(contents) if contents.trim_start().starts_with("---") => {
            let name = value_from_front_matter(&contents, "name").filter(|value| !value.is_empty()).unwrap_or(fallback);
            let description = value_from_front_matter(&contents, "description").unwrap_or_default();
            (name, description, None)
        }
        Ok(_) => (fallback, String::new(), Some("SKILL.md 缺少 YAML front matter".into())),
        Err(error) => (fallback, String::new(), Some(format!("无法读取 SKILL.md：{error}"))),
    }
}

fn discover_skills(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut found = vec![];
    let mut pending = vec![root.to_owned()];
    while let Some(dir) = pending.pop() {
        for entry in fs::read_dir(&dir).map_err(|e| format!("无法读取 {}：{e}", dir.display()))? {
            let path = entry.map_err(|e| e.to_string())?.path();
            if !path.is_dir() { continue; }
            let actual = match normalized(&path) { Ok(value) => value, Err(_) => continue };
            if !actual.starts_with(root) { continue; }
            if actual.join("SKILL.md").is_file() { found.push(actual); } else { pending.push(actual); }
        }
    }
    found.sort(); found.dedup(); Ok(found)
}

fn validate_skill_path(path: &str) -> Result<PathBuf, String> {
    let root = normalized(&skills_root()?).map_err(|_| "找不到 ~/.agents 目录，请确认目录存在".to_string())?;
    let skill = normalized(Path::new(path))?;
    if skill == root || !skill.starts_with(&root) || !skill.is_dir() || !skill.join("SKILL.md").is_file() {
        return Err("目标不是 ~/.agents 下可删除的 skill 目录，请刷新后重试".into());
    }
    Ok(skill)
}

#[tauri::command]
pub fn skills_scan(app: AppHandle) -> Result<Vec<Skill>, String> {
    let root = normalized(&skills_root()?).map_err(|_| "找不到 ~/.agents 目录，请确认目录存在".to_string())?;
    let dirs = discover_skills(&root)?;
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
        let key = path.to_string_lossy().to_string(); let (name, native_description, parse_error) = parse_skill_manifest(&path);
        Skill { path: key.clone(), name, native_description, custom_description: descriptions.get(&key).cloned().unwrap_or_default(), parse_error, category_ids: memberships.get(&key).cloned().unwrap_or_default() }
    }).collect())
}

#[tauri::command]
pub fn skills_update_metadata(app: AppHandle, update: SkillMetadataUpdate) -> Result<(), String> {
    let path = validate_skill_path(&update.path)?;
    db(&app)?.execute("INSERT INTO skill_metadata(skill_path, custom_description) VALUES (?1, ?2) ON CONFLICT(skill_path) DO UPDATE SET custom_description=excluded.custom_description, updated_at=CURRENT_TIMESTAMP", params![path.to_string_lossy(), update.custom_description]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn skills_list_categories(app: AppHandle) -> Result<Vec<SkillCategory>, String> {
    let conn = db(&app)?;
    let mut statement = conn.prepare("SELECT id, name FROM skill_categories ORDER BY name COLLATE NOCASE").map_err(|e| e.to_string())?;
    let rows = statement.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    let mut categories = vec![];
    for row in rows {
        let (id, name) = row.map_err(|e| e.to_string())?;
        let mut memberships = conn.prepare("SELECT skill_path FROM skill_category_memberships WHERE category_id=?1 ORDER BY skill_path").map_err(|e| e.to_string())?;
        let skill_paths = memberships.query_map(params![id], |row| row.get(0)).map_err(|e| e.to_string())?.collect::<Result<Vec<String>, _>>().map_err(|e| e.to_string())?;
        categories.push(SkillCategory { id, name, skill_paths });
    }
    Ok(categories)
}

#[tauri::command]
pub fn skills_save_category(app: AppHandle, category: SkillCategorySave) -> Result<SkillCategory, String> {
    let name = category.name.trim(); if name.is_empty() { return Err("分类名称不能为空".into()); }
    let selected: HashSet<String> = category.skill_paths.iter().map(|path| validate_skill_path(path).map(|value| value.to_string_lossy().to_string())).collect::<Result<_, _>>()?;
    let mut conn = db(&app)?; let transaction = conn.transaction().map_err(|e| e.to_string())?;
    let id = if let Some(id) = category.id {
        if transaction.execute("UPDATE skill_categories SET name=?1 WHERE id=?2", params![name, id]).map_err(|e| e.to_string())? == 0 { return Err("分类不存在，请刷新后重试".into()); } id
    } else { transaction.execute("INSERT INTO skill_categories(name) VALUES (?1)", params![name]).map_err(|e| e.to_string())?; transaction.last_insert_rowid() };
    transaction.execute("DELETE FROM skill_category_memberships WHERE category_id=?1", params![id]).map_err(|e| e.to_string())?;
    for path in &selected { transaction.execute("INSERT INTO skill_category_memberships(category_id, skill_path) VALUES (?1, ?2)", params![id, path]).map_err(|e| e.to_string())?; }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(SkillCategory { id, name: name.to_string(), skill_paths: selected.into_iter().collect() })
}

#[tauri::command]
pub fn skills_delete_category(app: AppHandle, id: i64) -> Result<(), String> {
    let conn = db(&app)?; conn.execute("DELETE FROM skill_categories WHERE id=?1", params![id]).map_err(|e| e.to_string())?; Ok(())
}

#[tauri::command]
pub fn skills_delete_skill(app: AppHandle, path: String) -> Result<(), String> {
    let skill = validate_skill_path(&path)?;
    fs::remove_dir_all(&skill).map_err(|e| format!("无法删除 skill 目录 {}：{e}", skill.display()))?;
    let mut conn = db(&app)?; let transaction = conn.transaction().map_err(|e| e.to_string())?; let key = skill.to_string_lossy();
    transaction.execute("DELETE FROM skill_category_memberships WHERE skill_path=?1", params![key.as_ref()]).map_err(|e| e.to_string())?;
    transaction.execute("DELETE FROM skill_metadata WHERE skill_path=?1", params![key.as_ref()]).map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())?; Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn front_matter_fields_are_read() { assert_eq!(value_from_front_matter("---\nname: hello\ndescription: 'world'\n---\n", "name"), Some("hello".into())); assert_eq!(value_from_front_matter("# no front matter", "name"), None); }
    #[test] fn block_descriptions_are_decoded() {
        assert_eq!(value_from_front_matter("---\ndescription: >-\n  first line\n  second line\n---\n", "description"), Some("first line second line".into()));
        assert_eq!(value_from_front_matter("---\ndescription: |\n  first line\n  second line\n---\n", "description"), Some("first line\nsecond line".into()));
    }
}
