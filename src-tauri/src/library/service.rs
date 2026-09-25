// Library implementation; Tauri protocol entry points remain in commands::library.
use rusqlite::{params, Connection};
use std::collections::HashSet;
use tauri::AppHandle;
use crate::library::read_status::{library_root, normalized, set_read_status, validate_book_path, walk};
use super::{catalog, files, repository};
use super::types::{ImportResult, LibraryBook, MetadataUpdate};

fn db(app: &AppHandle) -> Result<Connection, String> {
    repository::open_database(app)
}

pub fn library_scan(app: AppHandle) -> Result<Vec<LibraryBook>, String> {
    let library = normalized(&library_root()?).map_err(|_| "找不到 Library 目录，请确认 ~/important/books/Library 存在".to_string())?;
    let conn = db(&app)?; let states = catalog::read_state_map(&library, &conn)?; let files = walk(&library)?;
    let mut current = HashSet::new(); let mut books = vec![];
    for file in files.into_iter().filter(|path| path.is_file()) {
        let book = normalized(&file)?;
        // A directory junction/symlink inside Library can point elsewhere. Never index it,
        // because later open/delete commands must remain confined to the book root.
        if !book.starts_with(&library) { continue; }
        let key = book.to_string_lossy().to_string(); current.insert(key.clone());
        let relative_path = book.strip_prefix(&library).unwrap().to_string_lossy().replace('\\', "/"); let title = files::title_from_path(&book); let read = states.get(&book).copied().unwrap_or(false);
        conn.execute("INSERT INTO library_books (book_path,relative_path,title,read_state) VALUES (?1,?2,?3,?4) ON CONFLICT(book_path) DO UPDATE SET relative_path=excluded.relative_path,title=excluded.title,read_state=excluded.read_state", params![key, relative_path, title, read as i64]).map_err(|e| e.to_string())?;
        let (priority, book_type, description) = conn.query_row("SELECT priority, book_type, description FROM library_books WHERE book_path=?1", params![key], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))).map_err(|e| e.to_string())?;
        books.push(LibraryBook { relative_path, title, path: key.clone(), priority, read, book_type, description });
    }
    let mut stmt = conn.prepare("SELECT book_path FROM library_books").map_err(|e| e.to_string())?;
    let stale = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    for key in stale.into_iter().filter(|key| !current.contains(key)) { conn.execute("DELETE FROM library_books WHERE book_path=?1", params![key]).map_err(|e| e.to_string())?; }
    Ok(books)
}
pub fn library_cached(app: AppHandle) -> Result<Vec<LibraryBook>, String> {
    let conn = db(&app)?; let mut statement = conn.prepare("SELECT book_path,relative_path,title,priority,read_state,book_type,description FROM library_books WHERE relative_path<>'' ORDER BY relative_path").map_err(|e| e.to_string())?;
    let books = statement.query_map([], |row| Ok(LibraryBook { path: row.get(0)?, relative_path: row.get(1)?, title: row.get(2)?, priority: row.get(3)?, read: row.get::<_, i64>(4)? != 0, book_type: row.get(5)?, description: row.get(6)? })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(books)
}
pub fn library_update_metadata(app: AppHandle, update: MetadataUpdate) -> Result<(), String> {
    let (_, book) = validate_book_path(&update.path)?; if !(0..=5).contains(&update.priority) { return Err("优先级必须在 0 到 5 星之间".into()); }
    db(&app)?.execute("INSERT INTO library_books (book_path,priority,book_type,description) VALUES (?1,?2,?3,?4) ON CONFLICT(book_path) DO UPDATE SET priority=excluded.priority,book_type=excluded.book_type,description=excluded.description,updated_at=CURRENT_TIMESTAMP", params![book.to_string_lossy(), update.priority, update.book_type, update.description]).map_err(|e| e.to_string())?; Ok(())
}
pub fn library_set_read_status(path: String, read: bool) -> Result<(), String> {
    set_read_status(path, read)
}
pub fn library_open_book(path: String) -> Result<(), String> { files::open_book(path) }
pub fn library_rename_book(app: AppHandle, path: String, title: String) -> Result<(), String> { files::rename_book(app, path, title) }
pub fn library_delete_book(app: AppHandle, path: String) -> Result<(), String> { files::delete_book(app, path) }
pub fn library_import(paths: Vec<String>, read: bool) -> Result<Vec<ImportResult>, String> { files::import_books(paths, read) }

#[cfg(test)] mod tests { use super::files::{renamed_book_path, title_from_path}; use std::path::{Path, PathBuf};
    #[test] fn title_removes_extension() { assert_eq!(title_from_path(Path::new("C:/书/量子力学.pdf")), "量子力学"); }
    #[test] fn rename_preserves_extension_and_rejects_invalid_names() {
        assert_eq!(renamed_book_path(Path::new("C:/Library/旧书.epub"), "新书").unwrap(), PathBuf::from("C:/Library/新书.epub"));
        assert!(renamed_book_path(Path::new("C:/Library/旧书.epub"), "错误/名称").is_err());
    }
}
