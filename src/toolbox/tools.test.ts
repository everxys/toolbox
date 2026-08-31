import assert from 'node:assert/strict';
import { getToolById, loadLastNcmPlaylistUrl, saveLastNcmPlaylistUrl } from './tools.ts';

const values = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
} as Storage;

assert.equal(getToolById('ncm').name, '网易云音乐歌单');
saveLastNcmPlaylistUrl('https://music.163.com/playlist?id=1');
assert.equal(loadLastNcmPlaylistUrl(), 'https://music.163.com/playlist?id=1');
