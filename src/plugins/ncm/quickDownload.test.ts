import assert from 'node:assert/strict';
import { downloadNcmTracks, toDownloadCommandArgs } from './download.ts';
import { fetchSongDetailsBatched, pendingTracks } from './quickDownload.ts';

const tracks = [
  { id: 1, name: '已下载', artists: ['甲'], album: '', duration: 0, v: 0 },
  { id: 2, name: '待下载', artists: ['乙'], album: '', duration: 0, v: 0 },
];
assert.deepEqual(pendingTracks(tracks, new Set([1])).map((track) => track.id), [2]);
assert.deepEqual(toDownloadCommandArgs(tracks[1], 'exhigh'), {
  id: 2, name: '待下载', artists: ['乙'], level: 'exhigh',
});

const downloaded: number[] = [];
const batchResult = await downloadNcmTracks(
  tracks,
  'exhigh',
  2,
  (track) => downloaded.push(track.id),
  async (track) => {
    if (track.id === 2) throw new Error('权限不足');
    return { filePath: 'C:/downloads/已下载.mp3' };
  },
);
assert.deepEqual(batchResult.successes.map(({ track }) => track.id), [1]);
assert.deepEqual(batchResult.failures.map(({ track, error }) => ({ id: track.id, error })), [
  { id: 2, error: '权限不足' },
]);
assert.deepEqual(downloaded, [1]);

const ids = Array.from({ length: 401 }, (_, index) => index + 1);
const requested: number[][] = [];
const songs = await fetchSongDetailsBatched(ids, async (chunk) => {
  requested.push(chunk);
  return chunk.map((id) => ({ id, name: String(id), artists: [], album: '', duration: 0, v: 0 }));
});
assert.deepEqual(requested.map((chunk) => chunk.length), [200, 200, 1]);
assert.deepEqual(songs.map((track) => track.id), ids);
