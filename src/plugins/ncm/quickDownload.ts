import { extractPlaylistId, fetchPlaylistDetail, fetchSongDetails } from './api.ts';
import { loadDownloadedIds } from './store.ts';
import type { Track } from './types.ts';

export const pendingTracks = (tracks: Track[], downloaded: Set<number>) =>
  tracks.filter((track) => !downloaded.has(track.id));

export async function fetchSongDetailsBatched(
  ids: number[],
  fetcher: (chunk: number[]) => Promise<Track[]> = fetchSongDetails,
) {
  const tracks: Track[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    tracks.push(...await fetcher(ids.slice(i, i + 200)));
  }
  return tracks;
}

export async function loadNcmDownloadPreview(url: string) {
  const id = extractPlaylistId(url);
  if (!id) throw new Error('无法解析歌单链接');
  const { info, trackIds } = await fetchPlaylistDetail(id);
  const tracks = await fetchSongDetailsBatched(trackIds.map((track) => track.id));
  return { info, pending: pendingTracks(tracks, loadDownloadedIds()) };
}

export const previewSummary = (tracks: Track[]) =>
  tracks.length === 0 ? '没有待下载歌曲' : `将下载 ${tracks.length} 首歌`;
