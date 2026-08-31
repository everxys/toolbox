import assert from 'node:assert/strict';
import { isPrimaryToolClick, runQuickAction } from './home.ts';
import { getToolById, loadLastNcmPlaylistUrl, saveLastNcmPlaylistUrl } from './tools.ts';

const values = new Map<string, string>();
globalThis.localStorage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => { values.delete(key); },
  setItem: (key: string, value: string) => { values.set(key, value); },
};

assert.equal(getToolById('ncm').name, '网易云音乐歌单');
saveLastNcmPlaylistUrl('https://music.163.com/playlist?id=1');
assert.equal(loadLastNcmPlaylistUrl(), 'https://music.163.com/playlist?id=1');
assert.equal(isPrimaryToolClick(0), true);
assert.equal(isPrimaryToolClick(2), false);

const events: string[] = [];
assert.throws(() => runQuickAction(
  () => events.push('closed'),
  () => {
    events.push('action');
    throw new Error('同步回调失败');
  },
), /同步回调失败/);
assert.deepEqual(events, ['closed', 'action']);
