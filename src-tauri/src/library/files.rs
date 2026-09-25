use rusqlite::params;
use std::{ffi::OsStr, fs, path::{Path, PathBuf}, process::Command};
use tauri::AppHandle;

use super::{paths::{library_root, normalized, state_root, validate_book_path}, read_status::{cleanup_empty_dirs, create_shortcut, link_path, links_pointing_to, walk}, repository};
use super::types::ImportResult;

pub fn title_from_path(path: &Path) -> String {
    path.file_stem().and_then(OsStr::to_str).unwrap_or_default().to_string()
}

pub fn renamed_book_path(book: &Path, title: &str) -> Result<PathBuf, String> {
    let title = title.trim();
    if title.is_empty() || title == "." || title == ".." { return Err("图书名称不能为空".into()); }
    if title.ends_with('.') || title.ends_with(' ') || title.chars().any(|ch| matches!(ch, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) { return Err("图书名称包含 Windows 不支持的字符，或以句点、空格结尾".into()); }
    let extension = book.extension().and_then(OsStr::to_str).filter(|value| !value.is_empty());
    let file_name = extension.map(|value| format!("{title}.{value}")).unwrap_or_else(|| title.to_string());
    Ok(book.parent().ok_or("图书缺少父目录")?.join(file_name))
}

pub fn open_book(path: String) -> Result<(), String> {
    let (_, book) = validate_book_path(&path)?;
    Command::new("cmd").args(["/C", "start", "", &book.to_string_lossy()]).spawn().map_err(|e| format!("无法打开图书：{e}"))?;
    Ok(())
}

pub fn rename_book(app: AppHandle, path: String, title: String) -> Result<(), String> {
    let (library, book) = validate_book_path(&path)?;
    let destination = renamed_book_path(&book, &title)?;
    if destination == book { return Ok(()); }
    if destination.exists() { return Err(format!("同一目录下已存在同名图书：{}", destination.display())); }
    let mut state_links = vec![];
    for root in [state_root(false)?, state_root(true)?] {
        let links = links_pointing_to(&root, &book)?;
        let target_link = link_path(&root, &library, &destination)?;
        if target_link.exists() && !links.iter().any(|link| link == &target_link) { return Err(format!("对应阅读状态目录中已存在同名快捷方式：{}", target_link.display())); }
        state_links.push((root, target_link, links));
    }
    fs::rename(&book, &destination).map_err(|e| format!("无法重命名 Library 中的图书：{e}"))?;
    let destination = normalized(&destination)?;
    for (root, target_link, links) in state_links {
        if links.is_empty() { continue; }
        for link in links { fs::remove_file(&link).map_err(|e| format!("无法更新阅读状态快捷方式：{e}"))?; cleanup_empty_dirs(&link, &root); }
        create_shortcut(&target_link, &destination)?;
    }
    let relative_path = destination.strip_prefix(&library).map_err(|_| "重命名后的图书不在 Library 中")?.to_string_lossy().replace('\\', "/");
    repository::open_database(&app)?.execute("UPDATE library_books SET book_path=?1, relative_path=?2, title=?3, updated_at=CURRENT_TIMESTAMP WHERE book_path=?4", params![destination.to_string_lossy(), relative_path, title_from_path(&destination), book.to_string_lossy()]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_book(app: AppHandle, path: String) -> Result<(), String> {
    let (_library, book) = validate_book_path(&path)?;
    for root in [state_root(false)?, state_root(true)?] { for link in links_pointing_to(&root, &book)? { fs::remove_file(&link).map_err(|e| format!("无法删除快捷方式：{e}"))?; cleanup_empty_dirs(&link, &root); } }
    fs::remove_file(&book).map_err(|e| format!("无法删除原书：{e}"))?;
    repository::open_database(&app)?.execute("DELETE FROM library_books WHERE book_path=?1", params![book.to_string_lossy()]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn import_books(paths: Vec<String>, read: bool) -> Result<Vec<ImportResult>, String> {
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
