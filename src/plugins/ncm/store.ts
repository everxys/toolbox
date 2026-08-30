/**
 * 已下载记录 - Tauri 用 SQLite，Web fallback 用 localStorage
 * Key = id (唯一hash)，解决同名同歌手冲突
 */
export const DOWNLOADED_KEY = 'ncm_downloaded_ids';

export function loadDownloadedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(DOWNLOADED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

export function saveDownloadedIds(ids: Set<number>) {
  localStorage.setItem(DOWNLOADED_KEY, JSON.stringify([...ids]));
}

export function markDownloaded(id: number) {
  const s = loadDownloadedIds();
  s.add(id);
  saveDownloadedIds(s);
}

export function isDownloaded(id: number): boolean {
  return loadDownloadedIds().has(id);
}

// Tauri SQLite 版本（生产）
// invoke('ncm_db_init'), invoke('ncm_db_mark_downloaded', {id, path}), invoke('ncm_db_list')
