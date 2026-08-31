import { extractPlaylistId, fetchPlaylistDetail, fetchSongDetails } from './api.ts';
import { downloadNcmTracks, type NcmTracksDownloadResult } from './download.ts';
import { loadDownloadedIds, markDownloaded } from './store.ts';
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

export const previewTrackLabels = (tracks: Track[]) =>
  tracks.slice(0, 10).map((track) =>
    `${track.name} - ${track.artists.join('、') || '未知歌手'}`);

type ConfirmNcmQuickDownloadOptions = {
  loggedIn: boolean;
  url: string;
  pending: Track[];
  level: string;
  validateLogin: () => Promise<boolean>;
  onUrlSaved: (url: string) => void;
  markDownloaded?: (id: number) => void;
  downloadTracks?: typeof downloadNcmTracks;
};

export type ConfirmNcmQuickDownloadResult =
  | { status: 'logged-out' }
  | { status: 'login-expired' }
  | { status: 'no-pending' }
  | { status: 'completed'; result: NcmTracksDownloadResult };

export async function confirmNcmQuickDownload({
  loggedIn,
  url,
  pending,
  level,
  validateLogin,
  onUrlSaved,
  markDownloaded: recordDownloaded = markDownloaded,
  downloadTracks = downloadNcmTracks,
}: ConfirmNcmQuickDownloadOptions): Promise<ConfirmNcmQuickDownloadResult> {
  if (!loggedIn) return { status: 'logged-out' };
  if (pending.length === 0) return { status: 'no-pending' };
  if (!(await validateLogin())) return { status: 'login-expired' };

  const savedUrl = url.trim();
  onUrlSaved(savedUrl);
  const result = await downloadTracks(
    pending,
    level,
    3,
    (track) => recordDownloaded(track.id),
  );
  return { status: 'completed', result };
}

export const quickDownloadResultMessage = ({
  successes,
  failures,
  callbackFailures,
}: NcmTracksDownloadResult) => {
  const messages = [`下载完成 ${successes.length} 首`];
  if (failures.length > 0) messages.push(`下载失败 ${failures.length} 首`);
  if (callbackFailures.length > 0) {
    messages.push(`其中 ${callbackFailures.length} 首已下载但记录失败`);
  }
  return messages.join('；');
};
