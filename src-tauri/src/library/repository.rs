use rusqlite::Connection;
use tauri::AppHandle;

pub fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let conn = crate::storage::open_database(app)?;
    conn.execute("CREATE TABLE IF NOT EXISTS library_books (book_path TEXT PRIMARY KEY, priority INTEGER NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 5), book_type TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', relative_path TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', read_state INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)", []).map_err(|e| e.to_string())?;
    // Existing Toolbox databases predate the cached scan fields. SQLite has no ADD COLUMN IF NOT EXISTS.
    for sql in ["ALTER TABLE library_books ADD COLUMN relative_path TEXT NOT NULL DEFAULT ''", "ALTER TABLE library_books ADD COLUMN title TEXT NOT NULL DEFAULT ''", "ALTER TABLE library_books ADD COLUMN read_state INTEGER NOT NULL DEFAULT 0"] {
        let _ = conn.execute(sql, []);
    }
    conn.execute("CREATE TABLE IF NOT EXISTS library_link_cache (link_path TEXT PRIMARY KEY, modified_at INTEGER NOT NULL, target_path TEXT NOT NULL)", []).map_err(|e| e.to_string())?;
    Ok(conn)
}
