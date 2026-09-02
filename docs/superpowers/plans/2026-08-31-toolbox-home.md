# Toolbox 首页与网易云快捷下载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Toolbox 增加工具首页、右键快捷菜单和网易云歌单的确认式快捷下载。

**Architecture:** App 维护轻量 `home | ncm` 视图和共享登录状态。工具注册表描述首页卡片及快捷操作；网易云快捷操作使用独立弹窗先解析并预览待下载歌曲，确认后复用抽取出的下载执行函数。

**Tech Stack:** React 18、TypeScript、Tauri v2、现有网易云 API、Node `--experimental-strip-types` 测试、Rust 后端下载命令。

**Spec:** `docs/superpowers/specs/2026-08-31-toolbox-home-design.md`

## Global Constraints

- 不引入路由库或新的 UI 依赖。
- 首页当前只注册“网易云音乐歌单”，但注册表必须允许后续新增工具。
- 快捷下载默认带出并允许编辑最后一次成功解析的歌单分享链接。
- 任何下载都必须保留现有的登录校验、音质选择、CDN 下载与已下载记录行为。
- 确认弹窗在未登录、链接无效、解析失败或没有待下载歌曲时不得开始下载。

---

### Task 1: 工具注册表与首页存储

**Files:**
- Create: `src/toolbox/tools.ts`
- Create: `src/toolbox/tools.test.ts`

**Interfaces:**
- Produces: `ToolId = 'ncm'`、`ToolDefinition`、`toolDefinitions`、`getToolById(id)`。
- Produces: `loadLastNcmPlaylistUrl()` 与 `saveLastNcmPlaylistUrl(url)`。

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/toolbox/tools.test.ts`

Expected: FAIL because `tools.ts` does not exist.

- [ ] **Step 3: Implement the registry and storage helpers**

```ts
export type ToolId = 'ncm';
export interface ToolDefinition {
  id: ToolId; name: string; description: string; icon: string;
  quickActions: Array<{ id: 'download-undownloaded'; label: string }>;
}
export const toolDefinitions: ToolDefinition[] = [{
  id: 'ncm', name: '网易云音乐歌单', description: '解析歌单并批量下载歌曲', icon: '🎵',
  quickActions: [{ id: 'download-undownloaded', label: '解析歌单并下载所有未下载歌曲' }],
}];
export const getToolById = (id: ToolId) => toolDefinitions.find((tool) => tool.id === id)!;
export const loadLastNcmPlaylistUrl = () =>
  localStorage.getItem('toolbox_last_ncm_playlist_url') ?? 'https://music.163.com/playlist?id=784204124';
export const saveLastNcmPlaylistUrl = (url: string) =>
  localStorage.setItem('toolbox_last_ncm_playlist_url', url);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --experimental-strip-types src/toolbox/tools.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/toolbox/tools.ts src/toolbox/tools.test.ts
git commit -m "feat: add toolbox tool registry"
```

### Task 2: 可复用的待下载预览

**Files:**
- Create: `src/plugins/ncm/quickDownload.ts`
- Create: `src/plugins/ncm/quickDownload.test.ts`

**Interfaces:**
- Consumes: `Track`、`extractPlaylistId`、`fetchPlaylistDetail`、`fetchSongDetails`、`loadDownloadedIds`。
- Produces: `pendingTracks(tracks, downloaded)` 与 `loadNcmDownloadPreview(url)`。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { pendingTracks } from './quickDownload.ts';

const tracks = [
  { id: 1, name: '已下载', artists: ['甲'], album: '', duration: 0, v: 0 },
  { id: 2, name: '待下载', artists: ['乙'], album: '', duration: 0, v: 0 },
];
assert.deepEqual(pendingTracks(tracks, new Set([1])).map((track) => track.id), [2]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts`

Expected: FAIL because `quickDownload.ts` does not exist.

- [ ] **Step 3: Implement the preview loader**

```ts
export const pendingTracks = (tracks: Track[], downloaded: Set<number>) =>
  tracks.filter((track) => !downloaded.has(track.id));

export async function loadNcmDownloadPreview(url: string) {
  const id = extractPlaylistId(url);
  if (!id) throw new Error('无法解析歌单链接');
  const { info, trackIds } = await fetchPlaylistDetail(id);
  const tracks = await fetchSongDetails(trackIds.map((track) => track.id));
  return { info, pending: pendingTracks(tracks, loadDownloadedIds()) };
}
export const previewSummary = (tracks: Track[]) =>
  tracks.length === 0 ? '没有待下载歌曲' : `将下载 ${tracks.length} 首歌`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/ncm/quickDownload.ts src/plugins/ncm/quickDownload.test.ts
git commit -m "feat: add ncm pending download preview"
```

### Task 3: 抽取共享下载执行函数

**Files:**
- Create: `src/plugins/ncm/download.ts`
- Modify: `src/plugins/ncm/PlaylistDownloader.tsx`
- Modify: `src/plugins/ncm/quickDownload.test.ts`

**Interfaces:**
- Produces: `toDownloadCommandArgs(track, level)`、`downloadNcmTrack(track, level)` 和 `downloadNcmTracks(tracks, level, concurrency, onSuccess)`。
- Existing page and 快捷弹窗都调用这些函数；任务队列保留现有并发、重试、状态更新与下载记录。

- [ ] **Step 1: Write the failing test**

```ts
import { toDownloadCommandArgs } from './download.ts';
assert.deepEqual(toDownloadCommandArgs(tracks[1], 'exhigh'), {
  id: 2, name: '待下载', artists: ['乙'], level: 'exhigh',
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts`

Expected: FAIL because `toDownloadCommandArgs` does not exist.

- [ ] **Step 3: Implement and refactor page calls**

```ts
export const toDownloadCommandArgs = (track: Track, level: string) => ({
  id: track.id, name: track.name, artists: track.artists, level,
});
export async function downloadNcmTrack(track: Track, level: string) {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<{ filePath: string }>('ncm_download', toDownloadCommandArgs(track, level));
}
export async function downloadNcmTracks(
  tracks: Track[], level: string, concurrency: number,
  onSuccess: (track: Track, result: { filePath: string }) => void,
) {
  await pool(tracks, concurrency, async (track) => {
    const result = await downloadNcmTrack(track, level);
    onSuccess(track, result);
  });
}
```

Replace both direct `invoke('ncm_download', ...)` calls in `PlaylistDownloader.tsx` with `downloadNcmTrack`; retain all page-owned queue state handling.

- [ ] **Step 4: Run test and build**

Run: `node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts && npm run build`

Expected: PASS and Vite exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/ncm/download.ts src/plugins/ncm/PlaylistDownloader.tsx src/plugins/ncm/quickDownload.test.ts
git commit -m "refactor: share ncm download execution"
```

### Task 4: 首页、右键菜单和返回导航

**Files:**
- Create: `src/toolbox/HomePage.tsx`
- Create: `src/toolbox/home.ts`
- Modify: `src/App.tsx`
- Modify: `src/plugins/ncm/PlaylistDownloader.tsx`
- Modify: `src/toolbox/tools.test.ts`

**Interfaces:**
- `HomePage({ onOpenTool, onQuickAction })` consumes `isPrimaryToolClick(button)` from `home.ts`。
- App view is `'home' | 'ncm'`, initially `'home'`.
- Downloader accepts optional `onBackHome(): void`.

- [ ] **Step 1: Write the failing interaction helper test**

```ts
import { isPrimaryToolClick } from './home.ts';
assert.equal(isPrimaryToolClick(0), true);
assert.equal(isPrimaryToolClick(2), false);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/toolbox/tools.test.ts`

Expected: FAIL because `home.ts` does not exist.

- [ ] **Step 3: Implement home and navigation**

Implement `isPrimaryToolClick = (button: number) => button === 0` in `home.ts`. Render `toolDefinitions` as cards in `HomePage.tsx`. Card left-click opens the tool. Card `onContextMenu` calls `preventDefault()` and stores the tool plus pointer coordinates; render a fixed-position menu at those coordinates. The menu closes on overlay click, Escape, or action selection.

In `App.tsx`, conditionally render `HomePage` or the existing NCM page. Keep login modal and login state at App level. Add a “返回首页” button to the NCM page through `onBackHome`.

- [ ] **Step 4: Run test and build**

Run: `node --experimental-strip-types src/toolbox/tools.test.ts && npm run build`

Expected: PASS and Vite exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/toolbox/HomePage.tsx src/toolbox/home.ts src/toolbox/tools.test.ts src/App.tsx src/plugins/ncm/PlaylistDownloader.tsx
git commit -m "feat: add toolbox home and context menu"
```

### Task 5: 网易云快捷下载确认弹窗

**Files:**
- Create: `src/plugins/ncm/NcmQuickDownloadDialog.tsx`
- Modify: `src/App.tsx`
- Modify: `src/plugins/ncm/quickDownload.ts`

**Interfaces:**
- `NcmQuickDownloadDialog({ open, initialUrl, loggedIn, validateLogin, onClose, onUrlSaved })`。
- The dialog calls `loadNcmDownloadPreview`; only its explicit confirmation calls the shared download runner.

- [ ] **Step 1: Extend the failing preview test**

```ts
import { previewSummary } from './quickDownload.ts';
assert.equal(previewSummary([{ ...tracks[1] }]), '将下载 1 首歌');
assert.equal(previewSummary([]), '没有待下载歌曲');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts`

Expected: FAIL because `previewSummary` does not exist.

- [ ] **Step 3: Implement confirmation-only download**

The dialog renders an editable URL input prefilled from `initialUrl`, a quality selector defaulting to `exhigh`, a “解析待下载歌曲” button, parse errors, summary text, up to 10 `歌名 - 歌手` rows, “取消”, and “确认下载”. Confirmation must return early with “请先扫码登录后再下载” when logged out; otherwise it calls `validateLogin()` and stops if that reports expiry. Only then call `onUrlSaved(url)` and `downloadNcmTracks(preview.pending, level, 3, onSuccess)` after the explicit click.

Wire App’s `onQuickAction('ncm', 'download-undownloaded')` to open it with `loadLastNcmPlaylistUrl()`.

- [ ] **Step 4: Run tests and build**

Run: `node --experimental-strip-types src/toolbox/tools.test.ts && node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts && npm run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/ncm/NcmQuickDownloadDialog.tsx src/plugins/ncm/quickDownload.ts src/plugins/ncm/quickDownload.test.ts src/App.tsx
git commit -m "feat: add ncm quick download confirmation"
```

### Task 6: Release verification

**Files:**
- Modify: none unless verification exposes a defect.

- [ ] **Step 1: Run full automated verification**

```bash
node --experimental-strip-types src/toolbox/tools.test.ts
node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts
node --experimental-strip-types src/plugins/ncm/store.test.ts
npm run build
cd src-tauri && cargo test
```

Expected: every command exits 0.

- [ ] **Step 2: Build the single executable**

Run: `npm run tauri -- build --no-bundle`

Expected: `src-tauri/target/release/toolbox.exe` is reported as built.

- [ ] **Step 3: Manually verify release behavior**

1. Startup view is the homepage and contains the 网易云音乐歌单 card.
2. Left-click opens the tool; “返回首页” returns to the card grid.
3. Right-click opens the custom menu rather than the browser default.
4. Quick action opens the URL dialog with the saved URL.
5. Parsing lists only pending songs; confirmation does not start downloads before click.
6. Logged-out confirmation is blocked; cancel makes no download request.

- [ ] **Step 4: Commit a verification correction only if one was needed**

If verification exposes a defect, start a fresh TDD cycle for that defect; stage and commit only the exact corrected source and test files with a descriptive commit message.
