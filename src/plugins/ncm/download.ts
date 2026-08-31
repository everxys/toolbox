import type { Track } from './types.ts';
import { pool } from './utils.ts';

export const toDownloadCommandArgs = (track: Track, level: string) => ({
  id: track.id,
  name: track.name,
  artists: track.artists,
  level,
});

export async function downloadNcmTrack(track: Track, level: string) {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<{ filePath: string }>('ncm_download', toDownloadCommandArgs(track, level));
}

export async function downloadNcmTracks(
  tracks: Track[],
  level: string,
  concurrency: number,
  onSuccess: (track: Track, result: { filePath: string }) => void,
) {
  await pool(tracks, concurrency, async (track) => {
    const result = await downloadNcmTrack(track, level);
    onSuccess(track, result);
  });
}
