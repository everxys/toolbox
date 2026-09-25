# Toolbox

Toolbox 是一个基于 **Tauri v2、React 与 TypeScript** 的 Windows 桌面工具箱。当前包含网易云歌单下载、图书馆和 Skill 管理三个功能；前端通过 Tauri 命令调用 Rust 后端，不提供浏览器 fetch fallback。

## 功能与本地数据

- **网易云歌单**：二维码登录、完整歌单下载、单曲下载、首页“下载未下载歌曲”快捷入口、CSV 导出和下载记录。
- **图书馆**：扫描 `USERPROFILE/important/books/Library`，以同级 `read` / `unread` 中的 Windows 快捷方式作为阅读状态来源，支持元数据、导入、改名、打开和删除。
- **Skill 管理**：扫描 `USERPROFILE/.agents` 下含 `SKILL.md` 的目录；自定义描述和分类只存入 Toolbox 数据库，不修改源文件。
- **数据库设置**：默认数据库及设置位于应用数据目录；数据库文件固定名为 `toolbox.db`，可迁移或选择已有数据库。迁移保留源文件，选择已有数据库时先备份当前数据库。

NCM 登录 Cookie 存在应用数据目录的 `ncm_login_cookie.txt`；音乐下载写入系统下载目录。不要手动编辑这些文件，尤其不要将 Cookie 提交到版本库。

## 目录概览

```text
src/
  plugins/
    ncm/       # 登录、歌单、队列、快捷下载及其 API
    library/   # 图书页面、导入、树和数据 hook
    skills/    # Skill 页面、分类、表格和数据 hook
  shared/ui/   # 可复用展示组件
  toolbox/     # 首页、设置、工具壳与更新入口
src-tauri/src/
  commands/    # 稳定的 30 个 Tauri 命令协议入口
  library/ ncm/ skills/ storage.rs
  desktop.rs   # 窗口、托盘和桌面装配
docs/refactoring/
  2026-09-25-validation.md # 分阶段验证与人工验收记录
```

## 开发与验证

本仓库当前在 Node **26.7.0**、Rust stable 上验证。安装依赖后运行：

```bash
npm ci
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked
cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked
```

启动桌面应用：

```bash
npm run tauri:dev
```

也提供 `library_state_cli` Rust binary，供隔离地检查图书阅读状态相关逻辑；它不替代对真实 Windows 快捷方式的人工验收。

## CI 与发布

`.github/workflows/verify.yml` 在 Windows 上运行 `npm ci`、前端测试/构建以及 Rust 全 target test/check。现有 `build.yml` 继续专门负责已签名的发布构建与 release，不因验证流程改变其触发条件、签名或发布步骤。

## 兼容约定

重构不改变 Tauri 命令名、参数名、camelCase JSON 形状、数据库名/表和用户文件位置。完整歌单批量下载、单曲下载和首页快捷下载有不同的取消、重试与记录策略，不能在重构中视作同一种流程。
