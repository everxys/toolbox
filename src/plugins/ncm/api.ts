/**
 * NCM API - 前端直接调用（开发）/ 生产通过 Rust 后端代理以带 Cookie
 * 借鉴 open-orpheus/src/main/cookie.ts 的 deviceId/appver 注入 + Binaryify/NeteaseCloudMusicApi 的 QR 流程
 */

export function extractPlaylistId(shareUrl: string): number | null {
  // 支持 https://music.163.com/playlist?id=784204124&uct2=...
  // 也支持 https://music.163.com/m/playlist?id=...
  const m = shareUrl.match(/[?&]id=(\d+)/);
  return m ? Number(m[1]) : null;
}

// ---- QR 登录 ----
// 生产建议走 Rust command: invoke('ncm_qr_create'), invoke('ncm_qr_check')
// 这里提供前端直调版本便于调试（需后端代理解决 CORS / weapi 加密）
export async function qrCreate(): Promise<{ unikey: string; qrUrl: string }> {
  // @ts-ignore tauri invoke
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke('ncm_qr_create');
  } catch {
    // fallback: 直调公开 API (无需 weapi 加密的简易版，实测可用)
    const res = await fetch('https://music.163.com/api/login/qrcode/unikey?type=1');
    const j = await res.json();
    const unikey = j.unikey || j.data?.unikey;
    return { unikey, qrUrl: `https://music.163.com/login?codekey=${unikey}` };
  }
}

export async function qrCheck(unikey: string): Promise<{ code: number; cookie?: string; message: string }> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke('ncm_qr_check', { unikey });
  } catch {
    const res = await fetch(`https://music.163.com/api/login/qrcode/check?key=${unikey}&type=1&_=${Date.now()}`);
    const j = await res.json();
    return { code: j.code as number, cookie: j.cookie, message: j.message };
  }
}

// ---- 歌单 ----
export async function fetchPlaylistDetail(id: number): Promise<{ info: import('./types').PlaylistInfo; trackIds: { id: number; v: number }[] }> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke('ncm_playlist_detail', { id });
  } catch {
    // 前端直调（已验证 /tmp/playlist.json 的 v6 接口）
    const res = await fetch(`https://music.163.com/api/v6/playlist/detail?id=${id}`, {
      headers: { Referer: 'https://music.163.com/' },
    });
    const j = await res.json();
    const pl = j.playlist;
    return {
      info: {
        id: pl.id,
        name: pl.name,
        creator: pl.creator.nickname,
        trackCount: pl.trackCount,
        playCount: pl.playCount,
        coverUrl: pl.coverImgUrl,
      },
      trackIds: pl.trackIds,
    };
  }
}

export async function fetchSongDetails(ids: number[]): Promise<import('./types').Track[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke('ncm_song_detail', { ids });
  } catch {
    const res = await fetch(`https://music.163.com/api/song/detail?ids=[${ids.join(',')}]`, {
      headers: { Referer: 'https://music.163.com/' },
    });
    const j = await res.json();
    return (j.songs || []).map((s: any) => ({
      id: s.id,
      v: 0,
      name: s.name,
      artists: (s.artists || s.ar || []).map((a: any) => a.name),
      album: s.album?.name || s.al?.name || '',
      duration: s.duration || s.dt || 0,
      picUrl: s.album?.picUrl || s.al?.picUrl,
    }));
  }
}

export async function fetchPlayerUrl(id: number, level = 'standard'): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    const r: { url: string | null } = await invoke('ncm_player_url', { id, level });
    return r.url;
  } catch {
    const res = await fetch(`https://music.163.com/api/song/enhance/player/url/v1?ids=[${id}]&level=${level}&encodeType=mp3`, {
      headers: { Referer: 'https://music.163.com/' },
      credentials: 'include',
    });
    const j = await res.json();
    return j.data?.[0]?.url ?? null;
  }
}
