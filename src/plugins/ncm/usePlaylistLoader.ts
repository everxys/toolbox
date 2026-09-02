import { useState } from 'react';
import { extractPlaylistId, fetchPlaylistDetail, fetchSongDetails } from './api';
import { loadDownloadedIds } from './store';
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
      const all: Track[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const songs = await fetchSongDetails(chunk);
        for (const s of songs) {
          const v = vById.get(s.id);
          if (v !== undefined) s.v = v;
        }
        all.push(...songs);
      }
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
