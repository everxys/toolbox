import assert from 'node:assert/strict';
import { downloadNcmTracks, toDownloadCommandArgs } from './download.ts';
import {
  confirmNcmQuickDownload,
  createLatestRequestGate,
  extractSupportedNcmPlaylistId,
  fetchSongDetailsBatched,
  loadNcmDownloadPreview,
  pendingTracks,
  previewSummary,
  previewTrackLabels,
  quickDownloadResultMessage,
} from './quickDownload.ts';

const tracks = [
  { id: 1, name: '已下载', artists: ['甲'], album: '', duration: 0, v: 0 },
  { id: 2, name: '待下载', artists: ['乙'], album: '', duration: 0, v: 0 },
];
assert.equal(
  extractSupportedNcmPlaylistId('https://music.163.com/m/playlist?id=784204124'),
  784204124,
);
assert.equal(
  extractSupportedNcmPlaylistId('https://example.com/not-a-playlist?id=42'),
  null,
);
assert.equal(
  extractSupportedNcmPlaylistId('https://music.163.com/song?id=42'),
  null,
);
await assert.rejects(
  loadNcmDownloadPreview('https://example.com/not-a-playlist?id=42'),
  /仅支持网易云音乐歌单分享链接/,
);

const requestGate = createLatestRequestGate();
const writes: string[] = [];
let resolveFirstRequest!: (value: string) => void;
const firstRequestIsCurrent = requestGate.begin();
const firstRequest = new Promise<string>((resolve) => {
  resolveFirstRequest = resolve;
}).then((value) => {
  if (firstRequestIsCurrent()) writes.push(value);
});
requestGate.invalidate();
const secondRequestIsCurrent = requestGate.begin();
if (secondRequestIsCurrent()) writes.push('歌单 B');
resolveFirstRequest('歌单 A');
await firstRequest;
assert.deepEqual(writes, ['歌单 B']);

assert.deepEqual(pendingTracks(tracks, new Set([1])).map((track) => track.id), [2]);
assert.equal(previewSummary([{ ...tracks[1] }]), '将下载 1 首歌');
assert.equal(previewSummary([]), '没有待下载歌曲');
assert.deepEqual(
  previewTrackLabels(Array.from({ length: 12 }, (_, index) => ({
    ...tracks[1],
    id: index + 1,
    name: `歌曲${index + 1}`,
  }))),
  Array.from({ length: 10 }, (_, index) => `歌曲${index + 1} - 乙`),
);
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

const callbackFailureResult = await downloadNcmTracks(
  [tracks[0]],
  'exhigh',
  1,
  () => { throw new Error('状态写入失败'); },
  async () => ({ filePath: 'C:/downloads/已下载.mp3' }),
);
assert.deepEqual(callbackFailureResult.successes.map(({ track }) => track.id), [1]);
assert.deepEqual(callbackFailureResult.failures, []);
assert.deepEqual(callbackFailureResult.callbackFailures.map(({ track, error }) => ({ id: track.id, error })), [
  { id: 1, error: '状态写入失败' },
]);

const ids = Array.from({ length: 401 }, (_, index) => index + 1);
const requested: number[][] = [];
const songs = await fetchSongDetailsBatched(ids, async (chunk) => {
  requested.push(chunk);
  return chunk.map((id) => ({ id, name: String(id), artists: [], album: '', duration: 0, v: 0 }));
});
assert.deepEqual(requested.map((chunk) => chunk.length), [200, 200, 1]);
assert.deepEqual(songs.map((track) => track.id), ids);

let validated = 0;
let savedUrl = '';
let downloadCalls = 0;
let markedIds: number[] = [];
const runConfirmation = (loggedIn: boolean, validateLogin: () => Promise<boolean>) =>
  confirmNcmQuickDownload({
    loggedIn,
    url: ' https://music.163.com/playlist?id=2 ',
    pending: [tracks[1]],
    level: 'exhigh',
    validateLogin,
    onUrlSaved: (url) => { savedUrl = url; },
    markDownloaded: (id) => { markedIds.push(id); },
    downloadTracks: async (pending, level, concurrency, onSuccess) => {
      downloadCalls += 1;
      assert.deepEqual(pending.map((track) => track.id), [2]);
      assert.equal(level, 'exhigh');
      assert.equal(concurrency, 3);
      onSuccess(pending[0], { filePath: 'C:/downloads/待下载.mp3' });
      return {
        successes: [{ track: pending[0], result: { filePath: 'C:/downloads/待下载.mp3' } }],
        failures: [],
        callbackFailures: [],
      };
    },
  });

assert.deepEqual(await runConfirmation(false, async () => {
  validated += 1;
  return true;
}), { status: 'logged-out' });
assert.equal(validated, 0);
assert.equal(downloadCalls, 0);
assert.equal(savedUrl, '');

const invalidUrlResult = await confirmNcmQuickDownload({
  loggedIn: true,
  url: 'https://example.com/not-a-playlist?id=2',
  pending: [tracks[1]],
  level: 'exhigh',
  validateLogin: async () => {
    validated += 1;
    return true;
  },
  onUrlSaved: (url) => { savedUrl = url; },
  markDownloaded: (id) => { markedIds.push(id); },
  downloadTracks: async () => {
    downloadCalls += 1;
    return { successes: [], failures: [], callbackFailures: [] };
  },
});
assert.deepEqual(invalidUrlResult, { status: 'invalid-url' });
assert.equal(validated, 0);
assert.equal(downloadCalls, 0);
assert.equal(savedUrl, '');

const noPendingResult = await confirmNcmQuickDownload({
  loggedIn: true,
  url: 'https://music.163.com/playlist?id=2',
  pending: [],
  level: 'exhigh',
  validateLogin: async () => {
    validated += 1;
    return true;
  },
  onUrlSaved: (url) => { savedUrl = url; },
  markDownloaded: (id) => { markedIds.push(id); },
  downloadTracks: async () => {
    downloadCalls += 1;
    return { successes: [], failures: [], callbackFailures: [] };
  },
});
assert.deepEqual(noPendingResult, { status: 'no-pending' });
assert.equal(validated, 0);
assert.equal(downloadCalls, 0);
assert.equal(savedUrl, '');

assert.deepEqual(await runConfirmation(true, async () => {
  validated += 1;
  return false;
}), { status: 'login-expired' });
assert.equal(validated, 1);
assert.equal(downloadCalls, 0);
assert.equal(savedUrl, '');

const confirmed = await runConfirmation(true, async () => {
  validated += 1;
  return true;
});
assert.equal(confirmed.status, 'completed');
assert.equal(validated, 2);
assert.equal(downloadCalls, 1);
assert.equal(savedUrl, 'https://music.163.com/playlist?id=2');
assert.deepEqual(markedIds, [2]);

assert.equal(quickDownloadResultMessage({
  successes: [{ track: tracks[0], result: { filePath: 'C:/downloads/已下载.mp3' } }],
  failures: [{ track: tracks[1], error: '权限不足' }],
  callbackFailures: [{ track: tracks[0], error: '状态写入失败' }],
}), '下载完成 1 首；下载失败 1 首；其中 1 首已下载但记录失败');
