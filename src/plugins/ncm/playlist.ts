import type { Track } from './types';

export const extractPlaylistId = (shareUrl: string): number | null => {
  const match = shareUrl.match(/[?&]id=(\d+)/);
  return match ? Number(match[1]) : null;
};

export function extractSupportedNcmPlaylistId(shareUrl: string): number | null {
  try { const url = new URL(shareUrl.trim()); if (!['https:', 'http:'].includes(url.protocol) || url.hostname.toLowerCase() !== 'music.163.com') return null; const path = url.pathname.replace(/\/+$/, ''); const rawId = url.searchParams.get('id'); if ((path !== '/playlist' && path !== '/m/playlist') || !rawId || !/^\d+$/.test(rawId)) return null; const id = Number(rawId); return Number.isSafeInteger(id) && id > 0 ? id : null; } catch { return null; }
}

export async function fetchSongDetailsBatched(ids: number[], fetcher: (chunk: number[]) => Promise<Track[]>) {
  const tracks: Track[] = [];
  for (let index = 0; index < ids.length; index += 200) tracks.push(...await fetcher(ids.slice(index, index + 200)));
  return tracks;
}
