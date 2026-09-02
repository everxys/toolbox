# Toolbox 优化 TODO

> 生成时间: 2026-09-01 — 基于 `src/App.tsx`, `src/plugins/ncm/*`, `src/toolbox/*`, `src-tauri/src/commands/ncm.rs`, `package.json`, `vite.config.ts`, `tauri.conf.json` 全量审计

## P0 性能 / 稳定性（优先）

- [x] **Rust: 复用 reqwest Client** — `src-tauri/src/commands/ncm.rs:233,248,300,336,358,399` 每次 `Client::new()` 重建连接池。改为 `OnceLock<Client>` 单例，解决 TLS/DNS/keep-alive 开销。✅ 2026-09-01 已完成：`ncm.rs:11-25` 新增 `ncm_client()` 单例（timeout 15s/connect 10s/pool 90s），7 处 `Client::new()` 替换，`cargo test` 9 passed。
- [x] **Rust: 流式下载 + 非阻塞 FS** — `src-tauri/src/commands/ncm.rs:409-410` `response.bytes()+std::fs::write` 全量进内存并阻塞 Tokio。改为 `tokio::fs::File` + `bytes_stream` 边下边写 + `spawn_blocking`。✅ 2026-09-01 已完成：`Cargo.toml` 新增 `reqwest stream + futures-util`，`ncm_download:401` 改 `tokio::fs::create_dir_all/File::create + bytes_stream + write_all/flush`，DB 记录改 `spawn_blocking`，`cargo test` 9 passed / `cargo check` 通过。
- [x] **Rust: DB 批量事务** — `src-tauri/src/commands/ncm.rs:67-69,33-42` `ncm_mark_downloaded_many` 每ID `Connection::open` + `CREATE TABLE`。改为单 `Connection` + `BEGIN TRANSACTION` 批量插入。✅ 2026-09-01 已完成：`ncm.rs:80` 改单连接 `transaction + prepare` 循环执行，1000 ID 从 1000 次 open/DDL/fsync 降为 1 次事务，`cargo test` 9 passed。
- [x] **Rust: 同步 DB 不阻塞运行时** — `src-tauri/src/commands/ncm.rs:33-42` `rusqlite::Connection` 在 `async fn` 内同步调用。改为 `spawn_blocking` 或 `sqlx`。✅ 2026-09-01 已完成：`ncm_login_status:314` 读 cookie 改 `spawn_blocking(login_cookie_path) + tokio::fs::read_to_string`，失效清理改 `spawn_blocking(clear_login_cookie)`，避免阻塞 Tokio worker；`ncm_download` 已在 P0-2 用 `spawn_blocking(record_download)`，`cargo test` 9 passed。
- [x] **前端: 批量拉取去重复渲染** — `src/plugins/ncm/PlaylistDownloader.tsx:38-46` 循环内 `setTracks([...all])` 触发 N 次重渲染。改为循环外一次 `set`，复用 `src/plugins/ncm/quickDownload.ts:42` 的 `fetchSongDetailsBatched`。✅ 2026-09-01 已完成：改单次 `setTracks(all)`+ `Map` 赋值 `v`（`O(1)` 替代 `find`），`tsc --noEmit` 通过。
- [x] **前端: counts 单次聚合** — `src/plugins/ncm/PlaylistDownloader.tsx:105-111` + `src/plugins/ncm/DownloadQueue.tsx:9-14` 每渲染 5 次 `filter`。改为单次 `reduce` + `useMemo`。✅ 2026-09-01 已完成：`PlaylistDownloader:105` 与 `DownloadQueue:9` 均改为单次 `for` 聚合 + `useMemo([tasks])`，复杂度 O(5n) → O(n)。

## P1 架构 / 可维护

- [x] **拆分 App God 组件** — `src/App.tsx:10-54` 状态与逻辑集中，`logged/validateLogin` prop drilling。拆 `Router + AuthContext/Zustand`。✅ 2026-09-01 已完成：新增 `src/plugins/ncm/NcmAuthContext.tsx:1` 统一 `nickname/logged/refresh/login/logout/validateForDownload`，`App.tsx:11` 拆 `AuthHeader/AppShell/NcmAuthProvider`，`PlaylistDownloader`/`NcmQuickDownloadDialog` 改 `useNcmAuth` 去 prop drilling，`tsc`/`cargo test` 通过。
- [x] **统一前后端边界** — `src/plugins/ncm/api.ts:17-120` 每个方法 `try invoke catch fetch` 双实现。删除 fallback，统一走 Rust 代理。✅ 2026-09-01 已完成：`api.ts` 重构为单一 `invoke` 通道，移除 5 处 `fetch` fallback，新增 `invoke<T>` 复用入口，`tsc` 通过。
- [x] **拆分 PlaylistDownloader** — `src/plugins/ncm/PlaylistDownloader.tsx:12` 223 行职责过多。拆 `usePlaylistLoad` / `useDownloadQueue` / `useFilteredList` hooks。✅ 2026-09-01 已完成：新增 `usePlaylistLoader.ts`（拉取+Map赋值）、`useDownloadActions.ts`（批量/单曲/标记+auth）、`useTaskFiltering.ts`（筛选/搜索/分页/counts），`PlaylistDownloader.tsx:231→130` 行，`tsc`/`cargo test` 通过。
- [x] **清理重复/无效代码** — `src/toolbox/home.ts:8-61` `TOOL_ICON_SIZE_*` vs `CARD_SIZE_*` 6 对重复且 Icon 未使用；`src/plugins/ncm/pagination.ts:1` trivial 封装。删除或合并。✅ 2026-09-01 已完成：`home.ts` 抽 `normalizeSize/loadSize/saveSize` 合并 6 对重复，保留兼容导出；`pagination.ts` 删除、`PlaylistDownloader` 改 `setPage(1)`、测试更新、`tsc`/`node --test` 通过。
- [x] **补类型** — `src/plugins/ncm/PlaylistDownloader.tsx:15,140` `any` 丢失 `PlaylistInfo` 约束，补强类型。✅ 2026-09-01 已完成：`usePlaylistLoader`改 `PlaylistInfo|null` 强类型，`statusBadge` 改 `DownloadTask['status']` + `Record<status,...>`，`any` 已清零，`tsc --noEmit` 通过。

## P1 工程化

- [x] **构建校验与分包** — `package.json:8` `build` 仅 `vite build` 无 `tsc --noEmit`；`vite.config.ts:3-7` 缺 `manualChunks/sourcemap/target`。补 `build: "tsc --noEmit && vite build"` 与 `rollupOptions.output.manualChunks`。✅ 2026-09-01 已完成：`package.json:8` 改 `tsc --noEmit && vite build`，`vite.config.ts` 补 `target/esnext/sourcemap/outDir/manualChunks(react/tauri)`，`npm run build` 分出 `react 140k/tauri 0.1k/index 50k` 三 chunk。
- [x] **接入测试脚本** — `package.json:6` 无 `test/lint/format`，已有 `*.test.ts` 未接入 runner。接入 `vitest` + `npm run test` 并进 CI。✅ 2026-09-01 已完成：`package.json:6` 新增 `test/test:watch`（`node --test src/**/*.test.ts`，Node 22 原生 TS），`npm test` 3 passed，可直接进 CI（后续可换 vitest）。
- [x] **精简依赖** — `src-tauri/Cargo.toml:10-18` `tauri-plugin-sql/store` 未用、`rusqlite bundled` 与插件 SQLite 双份、`tokio full`、`chrono` 仅用 `timestamp_millis`。按需裁剪 feature。✅ 2026-09-01 已完成：移除 `tauri-plugin-store`（未用）及 `main.rs` 注册，`chrono`→`SystemTime::UNIX_EPOCH`，`tokio full`→`rt/rt-multi-thread/macros/time/fs/io-util/sync`，`cargo test/check` 通过（`rusqlite` 仍单 SQLite，`tauri-plugin-sql` 保留待后续统一）。

## P1 体验 / 健壮性

- [x] **替换 alert** — `src/App.tsx:42`, `src/plugins/ncm/PlaylistDownloader.tsx:31,58,68` 阻塞式 `alert`。换 toast/state 反馈。✅ 2026-09-01 已完成：`NcmAuthContext` 去 `alert`，`usePlaylistLoader` 加 `error` 状态，`useDownloadActions` 加 `feedback`，`PlaylistDownloader` 加 `loadError/exportError/actionFeedback/dirError` role=status 横幅，零 `alert`，`tsc` 通过。
- [ ] **补 load 错误处理** — `src/plugins/ncm/PlaylistDownloader.tsx:29-56` `try` 无 `catch`，网络失败无提示且残留半量数据。补 `catch` 与用户提示。
- [ ] **修复 QRLogin 竞态** — `src/plugins/ncm/QRLogin.tsx:19-49` interval 可能重入、`create` 无 try/catch。加防重入与错误边界。
- [ ] **搜索防抖** — `src/plugins/ncm/PlaylistDownloader.tsx:96` 千条 `toLowerCase includes` 每键触发。加 `debounce 200ms` / `useDeferredValue`。
- [ ] **节流 wheel 监听** — `src/toolbox/HomePage.tsx:42` `passive:false` 全局 `wheel` 无节流。加 `throttle`。
- [ ] **统一 ID 校验** — `src/plugins/ncm/api.ts:6-10` 宽松正则 vs `src/plugins/ncm/quickDownload.ts:20-35` 严格 URL 校验不一致。统一为严格校验。

## P2 安全 / 兼容

- [ ] **加密 Cookie 存储** — `src-tauri/src/commands/ncm.rs:271` `MUSIC_U` 明文写 `ncm_login_cookie.txt`。改 OS keychain 或加密存储。
- [ ] **跨平台打开目录** — `src-tauri/src/commands/ncm.rs:319` 硬编码 `explorer` 仅 Windows。改 `tauri-plugin-opener`。
- [ ] **加固文件名 sanitize** — `src-tauri/src/commands/ncm.rs:88-105` 仅过滤 `<>:"/\|?*`，未限长/去 `..`/RTL。补长度截断与规范化。
- [ ] **补 Tauri 安全配置** — `src-tauri/tauri.conf.json:11` `withGlobalTauri:true` 已废弃且暴露 `window.__TAURI__`，补 `csp` 与 `capabilities` allowlist。

## 验证

- [x] `cargo test` / `npm run test` 通过 — `cargo test` 9 passed / `npm test` 3 passed (2026-09-01)
- [x] `cargo build` / `npm run build`（含 `tsc --noEmit`）通过 — `vite build` 三 chunk / `cargo build` dev+release 通过，`tauri build` 生成 `toolbox.exe` + `msi` + `nsis-setup.exe`
- [ ] 手测：登录态持久化、歌单解析、批量下载、取消/重试、CSV 导出、打开下载目录
