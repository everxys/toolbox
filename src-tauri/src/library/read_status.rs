use std::{fs, path::{Path, PathBuf}};
use windows::{core::{Interface, PCWSTR}, Win32::{Storage::FileSystem::WIN32_FIND_DATAW, System::Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, STGM_READ}, UI::Shell::{IShellLinkW, ShellLink, SLGP_RAWPATH}}};
pub use super::paths::{library_root, link_path, normalized, state_root, validate_book_path};

fn shell_compatible_path(path: &Path) -> String {
    let value = path.as_os_str().to_string_lossy();
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") { format!(r"\\{rest}") }
    else { value.strip_prefix(r"\\?\").unwrap_or(&value).to_string() }
}

fn wide(path: &Path) -> Vec<u16> {
    shell_compatible_path(path).encode_utf16().chain(Some(0)).collect()
}

pub fn shortcut_target(link: &Path) -> Result<PathBuf, String> {
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().map_err(|error| error.to_string())?;
        let result = (|| {
            let shell: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).map_err(|error| error.to_string())?;
            let persist: IPersistFile = shell.cast().map_err(|error| error.to_string())?;
            let link = wide(link);
            persist.Load(PCWSTR(link.as_ptr()), STGM_READ).map_err(|error| error.to_string())?;
            let mut buffer = [0u16; 32768];
            shell.GetPath(&mut buffer, std::ptr::null_mut::<WIN32_FIND_DATAW>(), SLGP_RAWPATH.0 as u32).map_err(|error| error.to_string())?;
            let end = buffer.iter().position(|value| *value == 0).unwrap_or(0);
            if end == 0 { Err("快捷方式没有目标文件".into()) } else { Ok(PathBuf::from(String::from_utf16_lossy(&buffer[..end]))) }
        })();
        CoUninitialize();
        result
    }
}

pub fn create_shortcut(link: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(link.parent().ok_or("快捷方式缺少父目录")?).map_err(|error| error.to_string())?;
    let link = link.to_owned();
    let target = target.to_owned();
    std::thread::spawn(move || unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().map_err(|error| format!("初始化 Windows 快捷方式组件失败：{error}"))?;
        let result = (|| {
            let shell: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).map_err(|error| format!("创建 Windows 快捷方式组件失败：{error}"))?;
            let target = wide(&target);
            shell.SetPath(PCWSTR(target.as_ptr())).map_err(|error| format!("设置快捷方式目标失败：{error}"))?;
            let persist: IPersistFile = shell.cast().map_err(|error| format!("获取快捷方式保存接口失败：{error}"))?;
            let link = wide(&link);
            persist.Save(PCWSTR(link.as_ptr()), true).map_err(|error| format!("保存快捷方式失败：{error}"))
        })();
        CoUninitialize();
        result
    }).join().map_err(|_| "创建阅读状态快捷方式时发生意外错误".to_string())?
}


pub fn cleanup_empty_dirs(from: &Path, root: &Path) {
    let mut current = from.parent();
    while let Some(dir) = current {
        if dir == root || !dir.starts_with(root) { break; }
        if fs::read_dir(dir).ok().is_some_and(|mut entries| entries.next().is_none()) {
            let _ = fs::remove_dir(dir);
            current = dir.parent();
        } else { break; }
    }
}

pub fn walk(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = vec![];
    let mut directories = vec![root.to_owned()];
    while let Some(directory) = directories.pop() {
        for item in fs::read_dir(&directory).map_err(|error| format!("无法读取 {}：{error}", directory.display()))? {
            let path = item.map_err(|error| error.to_string())?.path();
            if path.is_dir() { directories.push(path); } else { files.push(path); }
        }
    }
    Ok(files)
}

pub fn links_pointing_to(root: &Path, book: &Path) -> Result<Vec<PathBuf>, String> {
    if !root.exists() { return Ok(vec![]); }
    let mut links = vec![];
    for entry in walk(root)? {
        if entry.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("lnk"))
            && shortcut_target(&entry).and_then(|target| normalized(&target)).is_ok_and(|target| target == book) {
            links.push(entry);
        }
    }
    Ok(links)
}

pub fn set_read_status(path: String, read: bool) -> Result<(), String> {
    let (library, book) = validate_book_path(&path)?;
    let target_root = state_root(read)?;
    let source_root = state_root(!read)?;
    fs::create_dir_all(&target_root).map_err(|error| error.to_string())?;
    let target = link_path(&target_root, &library, &book)?;
    let source_links = links_pointing_to(&source_root, &book)?;
    let target_links = links_pointing_to(&target_root, &book)?;
    if !source_links.is_empty() && !target_links.is_empty() {
        return Err("read 和 unread 中都存在这本书的快捷方式，请刷新后处理冲突".into());
    }
    if !source_links.is_empty() {
        if source_links.len() > 1 {
            return Err("同一阅读状态目录中存在多个指向这本书的快捷方式，请先手动保留一个再重试".into());
        }
        if target.exists() { return Err(format!("目标快捷方式已存在，无法安全迁移：{}", target.display())); }
        fs::create_dir_all(target.parent().ok_or("快捷方式缺少父目录")?).map_err(|error| error.to_string())?;
        let source = &source_links[0];
        fs::rename(source, &target).map_err(|error| format!("无法移动阅读状态快捷方式：{error}"))?;
        cleanup_empty_dirs(source, &source_root);
    } else if target_links.is_empty() {
        if target.exists() { return Err(format!("目标快捷方式已存在且指向其他文件：{}", target.display())); }
        create_shortcut(&target, &book)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{link_path, shell_compatible_path};
    use std::path::Path;

    #[test]
    fn link_path_mirrors_library_tree() {
        assert_eq!(link_path(Path::new("C:/read"), Path::new("C:/Library"), Path::new("C:/Library/灌篮高手/1.pdf")).unwrap(), Path::new("C:/read/灌篮高手/1.lnk"));
    }

    #[test]
    fn shell_paths_do_not_use_windows_verbatim_prefixes() {
        assert_eq!(shell_compatible_path(Path::new(r"\\?\C:\Library\book.epub")), r"C:\Library\book.epub");
        assert_eq!(shell_compatible_path(Path::new(r"\\?\UNC\server\share\book.epub")), r"\\server\share\book.epub");
    }
}
