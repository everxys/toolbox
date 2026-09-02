# Toolbox 公共导航与首页卡片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有工具页提供统一返回首页入口，并让首页方形工具卡片支持 Ctrl+滚轮缩放及持久化。

**Architecture:** `App` 以 `ToolPageShell` 包装每个非首页视图。`home.ts` 管理图标尺寸、边界和 localStorage；`HomePage` 仅在首页处理 Ctrl+滚轮。

**Tech Stack:** React 18、TypeScript、Tauri v2、Node `--experimental-strip-types`、localStorage。

**Spec:** `docs/superpowers/specs/2026-09-01-toolbox-shell-and-home-cards-design.md`

## Global Constraints

- 不引入路由库或新的 UI 依赖。
- 所有非首页工具页由 App 统一提供左上角“← 回到首页”；工具组件不渲染自己的返回首页按钮。
- 网易云分页区“回到第一页”只将页码设为 `1`。
- 仅在首页 Ctrl+滚轮调整图标；卡片保持方形，图标尺寸有边界并写入 localStorage。
- 普通滚动与工具页 Ctrl+滚轮不得触发首页图标缩放。

---

### Task 1: 图标尺寸状态和首页方形卡片

**Files:**
- Modify: `src/toolbox/home.ts`
- Modify: `src/toolbox/tools.test.ts`
- Modify: `src/toolbox/HomePage.tsx`

**Interfaces:**
- Produces: `DEFAULT_TOOL_ICON_SIZE = 32`、`MIN_TOOL_ICON_SIZE = 24`、`MAX_TOOL_ICON_SIZE = 80`。
- Produces: `adjustToolIconSize(current: number, deltaY: number): number`、`loadToolIconSize()`、`saveToolIconSize(size: number)`、`shouldAdjustToolIcons(event: Pick<WheelEvent, 'ctrlKey' | 'deltaY'>): boolean`。

- [ ] **Step 1: Write the failing tests**

```ts
import { adjustToolIconSize, loadToolIconSize, saveToolIconSize, shouldAdjustToolIcons, DEFAULT_TOOL_ICON_SIZE, MAX_TOOL_ICON_SIZE, MIN_TOOL_ICON_SIZE } from './home.ts';
assert.equal(adjustToolIconSize(DEFAULT_TOOL_ICON_SIZE, -1), DEFAULT_TOOL_ICON_SIZE + 4);
assert.equal(adjustToolIconSize(DEFAULT_TOOL_ICON_SIZE, 1), DEFAULT_TOOL_ICON_SIZE - 4);
assert.equal(adjustToolIconSize(MAX_TOOL_ICON_SIZE, -1), MAX_TOOL_ICON_SIZE);
assert.equal(adjustToolIconSize(MIN_TOOL_ICON_SIZE, 1), MIN_TOOL_ICON_SIZE);
assert.equal(shouldAdjustToolIcons({ ctrlKey: true, deltaY: -1 }), true);
assert.equal(shouldAdjustToolIcons({ ctrlKey: false, deltaY: -1 }), false);
saveToolIconSize(48);
assert.equal(loadToolIconSize(), 48);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/toolbox/tools.test.ts`

Expected: FAIL because the icon-size exports do not exist.

- [ ] **Step 3: Implement the helpers and card UI**

```ts
export const DEFAULT_TOOL_ICON_SIZE = 32;
export const MIN_TOOL_ICON_SIZE = 24;
export const MAX_TOOL_ICON_SIZE = 80;
const TOOL_ICON_SIZE_KEY = 'toolbox_tool_icon_size';
export const adjustToolIconSize = (current: number, deltaY: number) => Math.min(MAX_TOOL_ICON_SIZE, Math.max(MIN_TOOL_ICON_SIZE, current + (deltaY < 0 ? 4 : -4)));
export const shouldAdjustToolIcons = ({ ctrlKey, deltaY }: Pick<WheelEvent, 'ctrlKey' | 'deltaY'>) => ctrlKey && deltaY !== 0;
```

Add validated load/save helpers using `TOOL_ICON_SIZE_KEY`. In `HomePage`, use the saved size as local state; attach a non-passive wheel listener while mounted; prevent default only when the predicate is true; save only when clamping changes the size. Set cards to `aspectRatio: '1 / 1'`, center their content, apply the icon size, and show a Ctrl+滚轮 hint.

- [ ] **Step 4: Run tests and build**

Run: `node --experimental-strip-types src/toolbox/tools.test.ts && npx tsc --noEmit && npm run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

Run: `git add src/toolbox/home.ts src/toolbox/tools.test.ts src/toolbox/HomePage.tsx && git commit -m "feat: add resizable square tool cards"`

### Task 2: 公共工具页外壳与网易云分页语义

**Files:**
- Create: `src/toolbox/ToolPageShell.tsx`
- Create: `src/plugins/ncm/pagination.ts`
- Modify: `src/plugins/ncm/store.test.ts`
- Modify: `src/plugins/ncm/PlaylistDownloader.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `ToolPageShell({ children, onBackHome }: { children: ReactNode; onBackHome: () => void })`。
- Produces: `firstPlaylistPage(): number`, returning `1`.
- `PlaylistDownloader` consumes only `{ loggedIn: boolean; validateLogin: () => Promise<boolean> }`.

- [ ] **Step 1: Write the failing pagination test**

```ts
import { firstPlaylistPage } from './pagination.ts';
assert.equal(firstPlaylistPage(), 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/plugins/ncm/store.test.ts`

Expected: FAIL because `pagination.ts` does not exist.

- [ ] **Step 3: Implement the common shell and page behavior**

```ts
export const firstPlaylistPage = () => 1;
```

Create `ToolPageShell.tsx` with a left-aligned `<button onClick={onBackHome}>← 回到首页</button>` before `children`. In App, wrap every `view !== 'home'` component in this shell. Remove `onBackHome` from `PlaylistDownloader` and delete its title-row return button. Use `<button onClick={() => setPage(firstPlaylistPage())}>回到第一页</button>` in its pagination area.

- [ ] **Step 4: Run tests and build**

Run: `node --experimental-strip-types src/plugins/ncm/store.test.ts && node --experimental-strip-types src/toolbox/tools.test.ts && npx tsc --noEmit && npm run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

Run: `git add src/toolbox/ToolPageShell.tsx src/plugins/ncm/pagination.ts src/plugins/ncm/store.test.ts src/plugins/ncm/PlaylistDownloader.tsx src/App.tsx && git commit -m "feat: add shared tool page navigation"`

### Task 3: 发布验证与单文件 EXE

**Files:**
- Modify: none unless verification exposes a defect.

- [ ] **Step 1: Run automated verification**

```bash
node --experimental-strip-types src/toolbox/tools.test.ts
node --experimental-strip-types src/plugins/ncm/quickDownload.test.ts
node --experimental-strip-types src/plugins/ncm/store.test.ts
npx tsc --noEmit
npm run build
cd src-tauri && cargo test
```

Expected: every command exits 0.

- [ ] **Step 2: Build the single executable**

Run: `npm run tauri -- build --no-bundle`

Expected: exit 0 and report `src-tauri/target/release/toolbox.exe`.

- [ ] **Step 3: Manually verify the release UI**

1. 首页卡片为方形；按住 Ctrl 滚动可改变图标大小，普通滚动不改变图标。
2. 重启 EXE 后，图标大小保持上次设置。
3. 打开网易云工具后，公共左上角“← 回到首页”回到工具首页。
4. 网易云分页区保留“回到第一页”，并只将页码变为 1。
5. 右键快捷菜单与快捷下载弹窗仍可打开。

- [ ] **Step 4: Record any verification defect**

If a defect appears, record its reproduction and failing command before a fresh TDD fix cycle; do not stage unrelated dirty files.
