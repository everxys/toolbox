/**
 * NCM API - 统一走 Rust 后端代理（带 MUSIC_U Cookie、Referer、连接复用）
 * 已移除前端 fetch fallback，避免双实现导致行为不一致与排错困难。
 */

export function extractPlaylistId(shareUrl: string): number | null {
  const m = shareUrl.match(/[?&]id=(\d+)/);
  return m ? Number(m[1]) : null;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

export async function qrCreate(): Promise<{ unikey: string; qrUrl: string }> {
  return invoke('ncm_qr_create');
}

export async function qrCheck(unikey: string): Promise<{ code: number; cookie?: string; message: string }> {
  return invoke('ncm_qr_check', { unikey });
}

export async function setLoginCookie(cookie: string): Promise<void> {
  await invoke('ncm_set_login_cookie', { cookie });
}

export async function getLoginStatus(): Promise<{ nickname: string | null }> {
  return invoke('ncm_login_status');
}

export async function logout(): Promise<void> {
  await invoke('ncm_logout');
}

export async function openDownloadDir(): Promise<void> {
  await invoke('ncm_open_download_dir');
}

export async function fetchPlaylistDetail(id: number): Promise<{ info: import('./types').PlaylistInfo; trackIds: { id: number; v: number }[] }> {
  return invoke('ncm_playlist_detail', { id });
}

export async function fetchSongDetails(ids: number[]): Promise<import('./types').Track[]> {
  return invoke('ncm_song_detail', { ids });
}

export async function fetchPlayerUrl(id: number, level = 'standard'): Promise<string | null> {
  const r = await invoke<{ url: string | null }>('ncm_player_url', { id, level });
  return r.url;
}
