import assert from 'node:assert/strict';
import {
  adjustToolCardSize,
  DEFAULT_TOOL_CARD_SIZE,
  isPrimaryToolClick,
  MAX_TOOL_CARD_SIZE,
  MIN_TOOL_CARD_SIZE,
  runQuickAction,
  shouldAdjustToolCards,
} from './home.ts';
import { getToolById } from './tools.ts';
import { loadLastNcmPlaylistUrl, saveLastNcmPlaylistUrl } from '../plugins/ncm/preferences.ts';

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
assert.equal(getToolById('library').name, '图书馆');
assert.equal(getToolById('skills').name, 'Skill 管理');
saveLastNcmPlaylistUrl('https://music.163.com/playlist?id=1');
assert.equal(loadLastNcmPlaylistUrl(), 'https://music.163.com/playlist?id=1');
assert.equal(isPrimaryToolClick(0), true);
assert.equal(isPrimaryToolClick(2), false);

assert.equal(adjustToolCardSize(DEFAULT_TOOL_CARD_SIZE, -1), DEFAULT_TOOL_CARD_SIZE + 16);
assert.equal(adjustToolCardSize(DEFAULT_TOOL_CARD_SIZE, 1), DEFAULT_TOOL_CARD_SIZE - 16);
assert.equal(adjustToolCardSize(MAX_TOOL_CARD_SIZE, -1), MAX_TOOL_CARD_SIZE);
assert.equal(adjustToolCardSize(MIN_TOOL_CARD_SIZE, 1), MIN_TOOL_CARD_SIZE);
assert.equal(shouldAdjustToolCards({ ctrlKey: true, deltaY: -1 }), true);
assert.equal(shouldAdjustToolCards({ ctrlKey: false, deltaY: -1 }), false);

const events: string[] = [];
assert.throws(() => runQuickAction(
  () => events.push('closed'),
  () => {
    events.push('action');
    throw new Error('同步回调失败');
  },
), /同步回调失败/);
assert.deepEqual(events, ['closed', 'action']);
