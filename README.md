# Toolbox 跨平台工具箱

基于 **Tauri v2 + React + TypeScript**，模仿 `YUCLing/open-orpheus` 的跨平台思路（Electron 换 Tauri 以减小体积）。

## 已实现插件：网易云歌单批量下载

- **扫码登录**：`src/plugins/ncm/QRLogin.tsx` + `src-tauri/src/commands/ncm.rs::ncm_qr_create / ncm_qr_check`
  - 借鉴 `open-orpheus/src/main/cookie.ts` 的 `deviceId/appver/os` 注入，调用 `https://music.163.com/api/login/qrcode/unikey?type=1` 生成 `unikey`，`qrcode` 库渲染 `https://music.163.com/login?codekey=unikey`，每2s轮询 `…/check` 800/801/802/803。
- **分享链接解析**：`extractPlaylistId()` 正则 `id=(\d+)`，忽略 `uct2`。
- **全量拉取**：`GET /api/v6/playlist/detail?id=784204124` 拿 `trackIds[5508]`（已验证去重 0 重复），按 200 批 `GET /api/song/detail?ids=[...]` 补详情，hash = `id`。
- **已下载记录**：前端 `localStorage` + 生产 `tauri-plugin-sql sqlite:toolbox.db`，`CREATE TABLE downloaded(id PRIMARY KEY, path TEXT)`。
- **一键下载未下载**：`undone = trackIds - downloadedSet`，**并发 3 + 重试 3 + 可取消** (`utils.ts:pool` + `DownloadQueue.tsx`)，每任务带 `pending/downloading/done/error`，进度条，失败重试；Rust `ncm_download` 带 `MUSIC_U` 调 ` /api/song/enhance/player/url/v1?level=standard` 取真实 `url` 并落盘到 `app_data_dir()`。
- **导出 CSV**：`utils.ts:toCsv` 以 `id` 为 hash，`PlaylistDownloader.tsx:exportCsv` 一键导出 `id,name,artists,album,duration,v`，支持导出全部/当前筛选，已生成示例 `/tmp/playlist_784204124.csv` (200行演示，全量5508同格式)。
- **全量列表展示**：`PlaylistDownloader.tsx` 分页 100/页 (5508→56页)，顶部 4 个筛选 `全部/未下载/已下载/失败` + 搜索 `歌名/歌手/id`，表格列 `hash(id)/歌名/歌手/专辑/状态/操作`，状态彩色徽章，已下载持久化于 `localStorage`/`SQLite`，翻页、搜索、筛选均即时生效。

## 目录

```
toolbox/
  src/plugins/ncm/
    api.ts                # 前端直调 / Tauri invoke 双兼容
    QRLogin.tsx
    PlaylistDownloader.tsx # 并发下载 + CSV 导出
    DownloadQueue.tsx     # 进度条/并发显示/重试
    utils.ts              # pool(并发池)/toCsv
    store.ts
    types.ts
  src-tauri/src/commands/ncm.rs
  scripts/ncm_demo.py     # 无需登录的可运行验证脚本
  scripts/export_csv.py   # 生成 CSV 示例
```

## 快速开始

```bash
# 1. 验证链路（无需 Tauri，已验证 784204124 可拉 5508）
python3 scripts/ncm_demo.py "https://music.163.com/playlist?id=784204124"

# 2. 前端开发（需 Node 18+）
npm install
npm run tauri:dev   # 或 npm run dev 仅前端

# 3. 打包
npm run tauri:build
```

## 注意事项

- 下载需用户已登录且拥有版权，`player/url` 无 `url` 时提示 VIP/无版权。
- 遵守网易云服务条款，仅用于已购/可试听内容的本地备份。
