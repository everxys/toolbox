use rusqlite::{params, Connection, OptionalExtension};
use std::{collections::HashMap, path::{Path, PathBuf}};

use super::{paths::{normalized, state_root}, read_status::{shortcut_target, walk}};

fn modified_at(path: &Path) -> Result<i64, String> {
    path.metadata().map_err(|e| e.to_string())?.modified().map_err(|e| e.to_string())?.duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string()).map(|value| value.as_millis() as i64)
}

fn cached_link_target(conn: &Connection, link: &Path, stamp: i64) -> Result<Option<PathBuf>, String> {
    let key = link.to_string_lossy();
    conn.query_row("SELECT target_path FROM library_link_cache WHERE link_path=?1 AND modified_at=?2", params![key.as_ref(), stamp], |row| row.get::<_, String>(0)).optional().map_err(|e| e.to_string()).map(|value| value.map(PathBuf::from))
}

pub fn read_state_map(library: &Path, conn: &Connection) -> Result<HashMap<PathBuf, bool>, String> {
    let mut states = HashMap::new();
    for (read, root) in [(false, state_root(false)?), (true, state_root(true)?)] {
        if !root.exists() { continue; }
        for entry in walk(&root)? {
            if entry.extension().is_some_and(|v| v.eq_ignore_ascii_case("lnk")) {
                let stamp = match modified_at(&entry) { Ok(value) => value, Err(_) => continue };
                let target = match cached_link_target(conn, &entry, stamp)? {
                    Some(value) => Ok(value),
                    None => shortcut_target(&entry).and_then(|path| normalized(&path)).map(|target| {
                        let _ = conn.execute("INSERT INTO library_link_cache(link_path,modified_at,target_path) VALUES (?1,?2,?3) ON CONFLICT(link_path) DO UPDATE SET modified_at=excluded.modified_at,target_path=excluded.target_path", params![entry.to_string_lossy(), stamp, target.to_string_lossy()]); target
                    }),
                };
                if let Ok(target) = target {
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
