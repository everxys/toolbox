use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, ffi::OsStr, fs, path::{Path, PathBuf}, process::Command};
use windows::{core::{Interface, PCWSTR}, Win32::{Storage::FileSystem::WIN32_FIND_DATAW, System::Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, STGM_READ}, UI::Shell::{IShellLinkW, ShellLink, SLGP_RAWPATH}}};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryBook {
    pub path: String,
    pub relative_path: String,
    pub title: String,
    pub priority: i64,
    pub read: bool,
    pub book_type: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataUpdate { pub path: String, pub priority: i64, pub book_type: String, pub description: String }
#[derive(Debug, Serialize)] #[serde(rename_all = "camelCase")]
pub struct ImportResult { pub source: String, pub status: String, pub message: String }

fn library_root() -> Result<PathBuf, String> {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("important").join("books").join("Library"))
        .ok_or_else(|| "无法确定当前用户的主目录（缺少 USERPROFILE）".into())
}
fn state_root(read: bool) -> Result<PathBuf, String> {
    let home = std::env::var_os("USERPROFILE").map(PathBuf::from).ok_or("无法确定当前用户的主目录（缺少 USERPROFILE）")?;
    Ok(home.join("important").join("books").join(if read { "read" } else { "unread" }))
}
fn normalized(path: &Path) -> Result<PathBuf, String> { fs::canonicalize(path).map_err(|e| format!("无法解析路径 {}：{e}", path.display())) }
fn validate_book_path(path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = normalized(&library_root()?)?;
    let book = normalized(Path::new(path))?;
    if !book.starts_with(&root) || !book.is_file() { return Err("图书不在 Library 目录中或已不存在，请刷新后重试".into()); }
    Ok((root, book))
}
fn title_from_path(path: &Path) -> String { path.file_stem().and_then(OsStr::to_str).unwrap_or_default().to_string() }
fn db(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("toolbox.db")).map_err(|e| e.to_string())?;
    conn.execute("CREATE TABLE IF NOT EXISTS library_books (book_path TEXT PRIMARY KEY, priority INTEGER NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 5), book_type TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)", []).map_err(|e| e.to_string())?;
    Ok(conn)
}
fn wide(path: &Path) -> Vec<u16> { path.as_os_str().to_string_lossy().encode_utf16().chain(Some(0)).collect() }
fn shortcut_target(link: &Path) -> Result<PathBuf, String> {
    unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().map_err(|e| e.to_string())?; let result = (|| { let shell: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).map_err(|e| e.to_string())?; let persist: IPersistFile = shell.cast().map_err(|e| e.to_string())?; let link = wide(link); persist.Load(PCWSTR(link.as_ptr()), STGM_READ).map_err(|e| e.to_string())?; let mut buffer = [0u16; 32768]; shell.GetPath(&mut buffer, std::ptr::null_mut::<WIN32_FIND_DATAW>(), SLGP_RAWPATH.0 as u32).map_err(|e| e.to_string())?; let end = buffer.iter().position(|value| *value == 0).unwrap_or(0); if end == 0 { Err("快捷方式没有目标文件".into()) } else { Ok(PathBuf::from(String::from_utf16_lossy(&buffer[..end]))) } })(); CoUninitialize(); result }
}
fn create_shortcut(link: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(link.parent().ok_or("快捷方式缺少父目录")?).map_err(|e| e.to_string())?; unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().map_err(|e| e.to_string())?; let result = (|| { let shell: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).map_err(|e| e.to_string())?; let target = wide(target); shell.SetPath(PCWSTR(target.as_ptr())).map_err(|e| e.to_string())?; let persist: IPersistFile = shell.cast().map_err(|e| e.to_string())?; let link = wide(link); persist.Save(PCWSTR(link.as_ptr()), true).map_err(|e| e.to_string()) })(); CoUninitialize(); result }
}
fn link_path(root: &Path, library: &Path, book: &Path) -> Result<PathBuf, String> {
    let relative = book.strip_prefix(library).map_err(|_| "图书路径不在 Library 中")?;
    Ok(root.join(relative).with_extension("lnk"))
}
fn cleanup_empty_dirs(from: &Path, root: &Path) {
    let mut current = from.parent();
    while let Some(dir) = current {
        if dir == root || !dir.starts_with(root) { break; }
        if fs::read_dir(dir).ok().is_some_and(|mut entries| entries.next().is_none()) { let _ = fs::remove_dir(dir); current = dir.parent(); } else { break; }
    }
}
fn read_state_map(library: &Path) -> Result<HashMap<PathBuf, bool>, String> {
    let mut states = HashMap::new();
    for (read, root) in [(false, state_root(false)?), (true, state_root(true)?)] {
        if !root.exists() { continue; }
        for entry in walk(&root)? {
            if entry.extension().is_some_and(|v| v.eq_ignore_ascii_case("lnk")) {
                if let Ok(target) = shortcut_target(&entry).and_then(|p| normalized(&p)) {
                    if target.starts_with(library) {
                        if let Some(existing) = states.get(&target) {
                            if *existing != read { return Err(format!("同一本书同时存在于 read 和 unread：{}", target.display())); }
                        } else { states.insert(target, read); }
                    }
                }
            }
        }
    }
    Ok(states)
}
fn links_pointing_to(root: &Path, book: &Path) -> Result<Vec<PathBuf>, String> {
    if !root.exists() { return Ok(vec![]); }
    let mut links = vec![];
    for entry in walk(root)? {
        if entry.extension().is_some_and(|value| value.eq_ignore_ascii_case("lnk")) {
            if shortcut_target(&entry).and_then(|target| normalized(&target)).is_ok_and(|target| target == book) {
                links.push(entry);
            }
        }
    }
    Ok(links)
}
fn walk(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut out = vec![]; let mut dirs = vec![root.to_owned()];
    while let Some(dir) = dirs.pop() { for item in fs::read_dir(&dir).map_err(|e| format!("无法读取 {}：{e}", dir.display()))? { let path = item.map_err(|e| e.to_string())?.path(); if path.is_dir() { dirs.push(path); } else { out.push(path); } } }
    Ok(out)
}

#[tauri::command]
pub fn library_scan(app: AppHandle) -> Result<Vec<LibraryBook>, String> {
    let library = normalized(&library_root()?).map_err(|_| "找不到 Library 目录，请确认 ~/important/books/Library 存在".to_string())?;
    let states = read_state_map(&library)?; let conn = db(&app)?; let files = walk(&library)?;
    let mut current = HashSet::new(); let mut books = vec![];
    for file in files.into_iter().filter(|path| path.is_file()) {
        let book = normalized(&file)?;
        // A directory junction/symlink inside Library can point elsewhere. Never index it,
        // because later open/delete commands must remain confined to the book root.
        if !book.starts_with(&library) { continue; }
        let key = book.to_string_lossy().to_string(); current.insert(key.clone());
        conn.execute("INSERT OR IGNORE INTO library_books (book_path) VALUES (?1)", params![key]).map_err(|e| e.to_string())?;
        let (priority, book_type, description) = conn.query_row("SELECT priority, book_type, description FROM library_books WHERE book_path=?1", params![key], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))).map_err(|e| e.to_string())?;
        books.push(LibraryBook { relative_path: book.strip_prefix(&library).unwrap().to_string_lossy().replace('\\', "/"), title: title_from_path(&book), path: key.clone(), priority, read: states.get(&book).copied().unwrap_or(false), book_type, description });
    }
    let mut stmt = conn.prepare("SELECT book_path FROM library_books").map_err(|e| e.to_string())?;
    let stale = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    for key in stale.into_iter().filter(|key| !current.contains(key)) { conn.execute("DELETE FROM library_books WHERE book_path=?1", params![key]).map_err(|e| e.to_string())?; }
    Ok(books)
}
#[tauri::command]
pub fn library_update_metadata(app: AppHandle, update: MetadataUpdate) -> Result<(), String> {
    let (_, book) = validate_book_path(&update.path)?; if !(0..=5).contains(&update.priority) { return Err("优先级必须在 0 到 5 星之间".into()); }
    db(&app)?.execute("INSERT INTO library_books (book_path,priority,book_type,description) VALUES (?1,?2,?3,?4) ON CONFLICT(book_path) DO UPDATE SET priority=excluded.priority,book_type=excluded.book_type,description=excluded.description,updated_at=CURRENT_TIMESTAMP", params![book.to_string_lossy(), update.priority, update.book_type, update.description]).map_err(|e| e.to_string())?; Ok(())
}
#[tauri::command]
pub fn library_set_read_status(path: String, read: bool) -> Result<(), String> {
    let (library, book) = validate_book_path(&path)?; let target_root = state_root(read)?; let source_root = state_root(!read)?; fs::create_dir_all(&target_root).map_err(|e| e.to_string())?;
    let target = link_path(&target_root, &library, &book)?;
    let source_links = links_pointing_to(&source_root, &book)?;
    let target_links = links_pointing_to(&target_root, &book)?;
    if !source_links.is_empty() && !target_links.is_empty() { return Err("read 和 unread 中都存在这本书的快捷方式，请刷新后处理冲突".into()); }
    if !source_links.is_empty() {
        if target.exists() { return Err(format!("目标快捷方式已存在，无法安全迁移：{}", target.display())); }
        create_shortcut(&target, &book)?;
        for source in source_links { fs::remove_file(&source).map_err(|e| format!("无法删除旧快捷方式：{e}"))?; cleanup_empty_dirs(&source, &source_root); }
    } else if target_links.is_empty() {
        if target.exists() { return Err(format!("目标快捷方式已存在且指向其他文件：{}", target.display())); }
        create_shortcut(&target, &book)?;
    }
    Ok(())
}
#[tauri::command]
pub fn library_open_book(path: String) -> Result<(), String> { let (_, book) = validate_book_path(&path)?; Command::new("cmd").args(["/C", "start", "", &book.to_string_lossy()]).spawn().map_err(|e| format!("无法打开图书：{e}"))?; Ok(()) }
#[tauri::command]
pub fn library_delete_book(app: AppHandle, path: String) -> Result<(), String> {
    let (_library, book) = validate_book_path(&path)?;
    for root in [state_root(false)?, state_root(true)?] { for link in links_pointing_to(&root, &book)? { fs::remove_file(&link).map_err(|e| format!("无法删除快捷方式：{e}"))?; cleanup_empty_dirs(&link, &root); } }
    fs::remove_file(&book).map_err(|e| format!("无法删除原书：{e}"))?;
    db(&app)?.execute("DELETE FROM library_books WHERE book_path=?1", params![book.to_string_lossy()]).map_err(|e| e.to_string())?; Ok(())
}
#[tauri::command]
pub fn library_import(paths: Vec<String>, read: bool) -> Result<Vec<ImportResult>, String> {
    let library = library_root()?; fs::create_dir_all(&library).map_err(|e| e.to_string())?; let library = normalized(&library)?;
    let state = state_root(read)?; let mut results = vec![];
    for source in paths {
        let original = PathBuf::from(&source);
        let name = match original.file_name() { Some(name) => name, None => { results.push(ImportResult { source, status: "failed".into(), message: "无效的导入路径".into() }); continue; } };
        let destination = library.join(name);
        if destination.exists() { results.push(ImportResult { source, status: "conflict".into(), message: format!("Library 中已有同名项目：{}，请检查后再导入", destination.display()) }); continue; }
        if !original.exists() { results.push(ImportResult { source, status: "failed".into(), message: "源文件或文件夹已不存在".into() }); continue; }
        if let Err(error) = fs::rename(&original, &destination) { results.push(ImportResult { source, status: "failed".into(), message: format!("无法移动到 Library：{error}") }); continue; }
        let imported = if destination.is_dir() { walk(&destination)? } else { vec![destination.clone()] };
        let mut error = None;
        for file in imported.into_iter().filter(|path| path.is_file()) { let book = normalized(&file)?; let link = link_path(&state, &library, &book)?; if let Err(reason) = create_shortcut(&link, &book) { error = Some(reason); break; } }
        results.push(ImportResult { source, status: if error.is_some() { "partial".into() } else { "done".into() }, message: error.unwrap_or_else(|| "已移动到 Library 并创建阅读状态快捷方式".into()) });
    }
    Ok(results)
}

#[cfg(test)] mod tests { use super::*;
    #[test] fn title_removes_extension() { assert_eq!(title_from_path(Path::new("C:/书/量子力学.pdf")), "量子力学"); }
    #[test] fn link_path_mirrors_library_tree() { assert_eq!(link_path(Path::new("C:/read"), Path::new("C:/Library"), Path::new("C:/Library/灌篮高手/1.pdf")).unwrap(), PathBuf::from("C:/read/灌篮高手/1.lnk")); }
}
