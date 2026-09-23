import assert from 'node:assert/strict';
import { buildLibraryTree, filterAndSortLibraryTree, type LibraryBook } from './tree.ts';

const books: LibraryBook[] = [
  { path: 'C:/Library/灌篮高手/1.pdf', relativePath: '灌篮高手/1.pdf', title: '1', priority: 5, read: true, bookType: '漫画', description: '第一集' },
  { path: 'C:/Library/灌篮高手/2.pdf', relativePath: '灌篮高手/2.pdf', title: '2', priority: 2, read: false, bookType: '漫画', description: '' },
  { path: 'C:/Library/物理/量子.pdf', relativePath: '物理/量子.pdf', title: '量子', priority: 4, read: false, bookType: '物理', description: '入门' },
];

const tree = buildLibraryTree(books);
assert.equal(tree.children.length, 2);
assert.equal(tree.children[0].kind, 'folder');

const filtered = filterAndSortLibraryTree(tree, { read: false, hasDescription: true, query: '', priority: null, type: null, sort: { field: 'title', direction: 'asc' } });
assert.equal(filtered.children.length, 1);
assert.equal(filtered.children[0].name, '物理');

const sorted = filterAndSortLibraryTree(tree, { read: null, hasDescription: false, query: '', priority: null, type: '漫画', sort: { field: 'priority', direction: 'asc' } });
const slamDunk = sorted.children.find((node) => node.name === '灌篮高手');
assert.deepEqual(slamDunk?.children.map((node) => node.name), ['2', '1']);
