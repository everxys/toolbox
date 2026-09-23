import assert from 'node:assert/strict';
import { matchesSkillSearch } from './filters.ts';

const skill = { path: 'C:/skills/video', name: 'Video Writer', nativeDescription: 'Creates short video scripts', customDescription: '我的自媒体工具', parseError: null, categoryIds: [] };
assert.equal(matchesSkillSearch(skill, 'video'), true);
assert.equal(matchesSkillSearch(skill, '自媒体'), true);
assert.equal(matchesSkillSearch(skill, 'missing'), false);
