import { useState } from 'react';
import { fetchPlaylistDetail, fetchSongDetails, loadDownloadedIds } from './api';
import { extractPlaylistId, fetchSongDetailsBatched } from './playlist';
import type { DownloadTask, PlaylistInfo, Track } from './types';

export function usePlaylistLoader() {
  const [url, setUrl] = useState('https://music.163.com/playlist?id=784204124');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [info, setInfo] = useState<PlaylistInfo | null>(null);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const id = extractPlaylistId(url);
    if (!id) {
      setError('无法解析 id，请粘贴完整的分享链接');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { info: nextInfo, trackIds } = await fetchPlaylistDetail(id);
      setInfo(nextInfo);
      const ids = trackIds.map((t) => t.id);
      const vById = new Map(trackIds.map((t) => [t.id, t.v] as const));
      const all = await fetchSongDetailsBatched(ids, fetchSongDetails);
      for (const song of all) { const v = vById.get(song.id); if (v !== undefined) song.v = v; }
      setTracks(all);
      const downloaded = await loadDownloadedIds();
      const nextTasks = all.map((track) => ({
        track,
        status: (downloaded.has(track.id) ? 'done' : 'pending') as DownloadTask['status'],
        progress: downloaded.has(track.id) ? 100 : 0,
      }));
      setTasks(nextTasks);
    } finally {
      setLoading(false);
    }
  };

  return { url, setUrl, info, setInfo, tracks, setTracks, tasks, setTasks, loading, error, setError, load };
}
