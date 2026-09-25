import assert from 'node:assert/strict';
import { filterTasks, taskCounts, taskPage } from './taskSelectors.ts';

const tasks = [
  { track: { id: 1, name: '春天', artists: ['甲'], album: '', duration: 0, v: 0 }, status: 'pending' as const, progress: 0 },
  { track: { id: 2, name: '夏天', artists: ['乙'], album: '', duration: 0, v: 0 }, status: 'done' as const, progress: 100 },
  { track: { id: 3, name: '秋天', artists: ['甲'], album: '', duration: 0, v: 0 }, status: 'skipped' as const, progress: 0 },
  { track: { id: 4, name: '冬天', artists: ['丙'], album: '', duration: 0, v: 0 }, status: 'error' as const, progress: 0 },
];
assert.deepEqual(filterTasks(tasks, 'all', '甲').map((task) => task.track.id), [1, 3]);
assert.deepEqual(filterTasks(tasks, 'done', '').map((task) => task.track.id), [2]);
assert.deepEqual(taskCounts(tasks), { all: 4, pending: 1, done: 1, error: 1, downloading: 0 });
assert.deepEqual(taskPage(tasks, 2, 2).map((task) => task.track.id), [3, 4]);
