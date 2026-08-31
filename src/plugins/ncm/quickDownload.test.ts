import assert from 'node:assert/strict';
import { pendingTracks } from './quickDownload.ts';

const tracks = [
  { id: 1, name: '已下载', artists: ['甲'], album: '', duration: 0, v: 0 },
  { id: 2, name: '待下载', artists: ['乙'], album: '', duration: 0, v: 0 },
];
assert.deepEqual(pendingTracks(tracks, new Set([1])).map((track) => track.id), [2]);
