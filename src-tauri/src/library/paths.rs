use std::{fs, path::{Path, PathBuf}};

pub fn library_root() -> Result<PathBuf, String> {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("important").join("books").join("Library"))
        .ok_or_else(|| "无法确定当前用户的主目录（缺少 USERPROFILE）".into())
}

pub fn state_root(read: bool) -> Result<PathBuf, String> {
    let home = std::env::var_os("USERPROFILE").map(PathBuf::from).ok_or("无法确定当前用户的主目录（缺少 USERPROFILE）")?;
    Ok(home.join("important").join("books").join(if read { "read" } else { "unread" }))
}

pub fn normalized(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path).map_err(|error| format!("无法解析路径 {}：{error}", path.display()))
}

pub fn validate_book_path(path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = normalized(&library_root()?)?;
    let book = normalized(Path::new(path))?;
    if !book.starts_with(&root) || !book.is_file() {
        return Err("图书不在 Library 目录中或已不存在，请刷新后重试".into());
    }
    Ok((root, book))
}

pub fn link_path(root: &Path, library: &Path, book: &Path) -> Result<PathBuf, String> {
    let relative = book.strip_prefix(library).map_err(|_| "图书路径不在 Library 中")?;
    Ok(root.join(relative).with_extension("lnk"))
}
