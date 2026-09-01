import assert from 'node:assert/strict';
import {
  adjustToolIconSize,
  DEFAULT_TOOL_ICON_SIZE,
  isPrimaryToolClick,
  loadToolIconSize,
  MAX_TOOL_ICON_SIZE,
  MIN_TOOL_ICON_SIZE,
  runQuickAction,
  saveToolIconSize,
  shouldAdjustToolIcons,
} from './home.ts';
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

assert.equal(adjustToolIconSize(DEFAULT_TOOL_ICON_SIZE, -1), DEFAULT_TOOL_ICON_SIZE + 4);
assert.equal(adjustToolIconSize(DEFAULT_TOOL_ICON_SIZE, 1), DEFAULT_TOOL_ICON_SIZE - 4);
assert.equal(adjustToolIconSize(MAX_TOOL_ICON_SIZE, -1), MAX_TOOL_ICON_SIZE);
assert.equal(adjustToolIconSize(MIN_TOOL_ICON_SIZE, 1), MIN_TOOL_ICON_SIZE);
assert.equal(shouldAdjustToolIcons({ ctrlKey: true, deltaY: -1 }), true);
assert.equal(shouldAdjustToolIcons({ ctrlKey: false, deltaY: -1 }), false);
saveToolIconSize(48);
assert.equal(loadToolIconSize(), 48);
values.clear();
assert.equal(loadToolIconSize(), DEFAULT_TOOL_ICON_SIZE);
values.set('toolbox_tool_icon_size', 'not-a-size');
assert.equal(loadToolIconSize(), DEFAULT_TOOL_ICON_SIZE);
values.set('toolbox_tool_icon_size', String(MAX_TOOL_ICON_SIZE + 1));
assert.equal(loadToolIconSize(), DEFAULT_TOOL_ICON_SIZE);
saveToolIconSize(MAX_TOOL_ICON_SIZE + 10);
assert.equal(values.get('toolbox_tool_icon_size'), String(MAX_TOOL_ICON_SIZE));
saveToolIconSize(MIN_TOOL_ICON_SIZE - 10);
assert.equal(values.get('toolbox_tool_icon_size'), String(MIN_TOOL_ICON_SIZE));

const events: string[] = [];
assert.throws(() => runQuickAction(
  () => events.push('closed'),
  () => {
    events.push('action');
    throw new Error('同步回调失败');
  },
), /同步回调失败/);
assert.deepEqual(events, ['closed', 'action']);
