import assert from 'node:assert/strict';
import { toDownloadCommandArgs } from './download.ts';
import { fetchSongDetailsBatched, pendingTracks } from './quickDownload.ts';

const tracks = [
  { id: 1, name: '已下载', artists: ['甲'], album: '', duration: 0, v: 0 },
  { id: 2, name: '待下载', artists: ['乙'], album: '', duration: 0, v: 0 },
];
assert.deepEqual(pendingTracks(tracks, new Set([1])).map((track) => track.id), [2]);
assert.deepEqual(toDownloadCommandArgs(tracks[1], 'exhigh'), {
  id: 2, name: '待下载', artists: ['乙'], level: 'exhigh',
});

const ids = Array.from({ length: 401 }, (_, index) => index + 1);
const requested: number[][] = [];
const songs = await fetchSongDetailsBatched(ids, async (chunk) => {
  requested.push(chunk);
  return chunk.map((id) => ({ id, name: String(id), artists: [], album: '', duration: 0, v: 0 }));
});
assert.deepEqual(requested.map((chunk) => chunk.length), [200, 200, 1]);
assert.deepEqual(songs.map((track) => track.id), ids);
