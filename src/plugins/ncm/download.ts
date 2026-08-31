import type { Track } from './types.ts';
import { pool } from './utils.ts';

type DownloadResult = { filePath: string };
type DownloadTrack = (track: Track, level: string) => Promise<DownloadResult>;

export type NcmTracksDownloadResult = {
  successes: Array<{ track: Track; result: DownloadResult }>;
  failures: Array<{ track: Track; error: string }>;
};

export const toDownloadCommandArgs = (track: Track, level: string) => ({
  id: track.id,
  name: track.name,
  artists: track.artists,
  level,
});

export async function downloadNcmTrack(track: Track, level: string): Promise<DownloadResult> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<{ filePath: string }>('ncm_download', toDownloadCommandArgs(track, level));
}

export async function downloadNcmTracks(
  tracks: Track[],
  level: string,
  concurrency: number,
  onSuccess: (track: Track, result: DownloadResult) => void,
  downloadTrack: DownloadTrack = downloadNcmTrack,
): Promise<NcmTracksDownloadResult> {
  const successes: NcmTracksDownloadResult['successes'] = [];
  const failures: NcmTracksDownloadResult['failures'] = [];

  await pool(tracks, concurrency, async (track) => {
    try {
      const result = await downloadTrack(track, level);
      successes.push({ track, result });
      onSuccess(track, result);
    } catch (error) {
      failures.push({
        track,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { successes, failures };
}
