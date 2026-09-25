# Toolbox 重构验证记录

日期：2026-09-25  
执行基线：`3b9f993cff28104988ade4d60d88c7c34bfd6c6a`

## R0：基线与兼容契约

### 工作区归属

开始执行时已有、且不属于本次重构的改动：

- `src-tauri/src/bin/library_state_cli.rs`：CLI 从按路径包含 `library.rs` 改为包含 `commands/read_status.rs`。
- `src-tauri/src/commands/library.rs`：阅读状态和快捷方式实现改为调用 `read_status` 模块。
- `src-tauri/src/commands/mod.rs`：注册 `read_status` 模块。
- `src-tauri/src/commands/read_status.rs`：未跟踪的阅读状态/Windows 快捷方式提取实现。
- `docs/superpowers/specs/2026-09-25-toolbox-refactoring-design.md` 与 `docs/superpowers/plans/2026-09-25-toolbox-refactoring-plan.md`：未跟踪的设计与计划输入。

这些改动的已跟踪差异为 3 个文件、6 行新增、103 行删除；未跟踪的 `read_status.rs` 不在该统计内。后续 R1 必须保留其阅读状态算法及 CLI 参数/退出码语义，只改变模块归属。

### 工具版本与自动化验证

| 检查 | 结果 |
| --- | --- |
| Node | `v26.7.0` |
| npm | `11.19.0` |
| rustc | `1.98.0 (88d9e12ae 2026-08-18)` |
| cargo | `1.98.0 (797e8a9bc 2026-08-05)` |
| `npm test` | 5 个测试文件、5 项通过：library tree、NCM quick download、NCM store、skill filters、toolbox tools。 |
| `npm run build` | 通过（`tsc --noEmit` 与 Vite）。 |
| `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked` | 通过：主 binary 18 项、CLI binary 2 项。 |
| `cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked` | 通过。 |
| `git diff --check` | 通过；仅显示已有文件的 LF→CRLF 工作树提示。 |

已知测试缺口：`src/plugins/ncm/store.test.ts` 仅断言 `1 === 1`，是占位测试。现有快捷下载测试已固定严格 URL、200 条详情分片、请求代次 gate、下载参数 JSON、快捷下载 3 并发和同步回调失败统计；完整歌单页面的重试（3 次、500/1000ms）及取消（仅阻止尚未开始任务）仍与 React hook 耦合，R9 提取队列时必须补可控时序测试，不能把此缺口当作重构前行为失败。

### 命令协议静态核对

`main.rs` 的 `generate_handler!` 注册了设计冻结的全部 30 个命令：NCM 登录 5 个、NCM 内容/下载 5 个、NCM 下载记录 3 个、图书 8 个、Skill 6 个、数据库 3 个。

代表性前端负载已核对：

| 命令 | 当前前端负载/返回形状 |
| --- | --- |
| `ncm_qr_create` | 无参数；读取 `{ unikey, qrUrl }`。 |
| `ncm_player_url` | `{ id, level }`；读取 `{ url: string | null }`。 |
| `ncm_download` | `{ id, name, artists, level }`；读取 `{ filePath }`。 |
| `library_update_metadata` | `{ update: { path, priority, bookType, description } }`。 |
| `library_import` | `{ paths, read }`；读取逐项 `{ source, status, message }`。 |
| `skills_update_metadata` | `{ update: { path, customDescription } }`。 |
| `skills_save_category` | `{ category: { id?, name, skillPaths } }`。 |
| `database_migrate` / `database_use_existing` | 分别为 `{ directory }` / `{ path }`。 |

这项为静态审查记录，不把文本匹配误作运行时协议测试。R1 后的命令注册和 R3--R5 后的 DTO 序列化测试需要重新核对。

### 下载策略矩阵

| 流程 | URL 校验 | 详情 | 默认音质 | 并发/重试/取消 |
| --- | --- | --- | --- | --- |
| 完整歌单页批量 | 宽松正则提取 `id` | 顺序每批 200，回填 `v` | `exhigh` | 3 / 最多 3 次，500ms、1000ms / 只阻止未开始任务。 |
| 完整歌单页单曲 | 已加载 track | 不重载 | 当前选择值 | 独立单次、无重试、无取消。 |
| 首页快捷下载 | 严格 `music.163.com` 且 `/playlist` 或 `/m/playlist` | 顺序每批 200，不回填 `v` | `exhigh` | 3 / 单次 / 下载时禁止关闭弹窗。 |

### 合成夹具与人工验收

尚未建立会触及真实用户目录的夹具。R2/R3 将在系统临时目录创建以下合成对象：无缓存列的 `library_books`、当前表结构、含中文与空格的文件名、损坏 SQLite、同名冲突文件及独立 read/unread 目录。不得使用实际书库、Cookie 或应用数据库。

R0 未执行真实书库快捷方式改写、数据库迁移/切换、联网音乐下载、更新安装或桌面窗口启动关闭；这些均为后续阶段的人工验收项目，不是当前自动化通过的结论。

## R1：Rust library target 与桌面装配

### 实际变更

- 新增 `src-tauri/src/lib.rs`：包含原有模块声明、Tauri Builder、唯一的 `LoginState` 管理及完全相同的 30 项命令注册，并公开 `toolbox::run()`。
- 新增 `src-tauri/src/desktop.rs`：原样迁出窗口状态保存/恢复、托盘创建、托盘点击恢复窗口和主窗口关闭即退出逻辑；原有两个测试随之迁移。
- `src-tauri/src/main.rs` 保留 Windows release subsystem 属性，仅调用 `toolbox::run()`。
- 新增 `src-tauri/src/library/mod.rs` 与 `library/read_status.rs`：将 R0 发现的用户未提交 `commands/read_status.rs` 原样迁入；CLI 改为使用 `toolbox::library::set_read_status`，不再通过 `#[path]` 包含源码。`commands/library.rs` 改从 library 模块引用相同 helper。
- `commands/mod.rs` 不再注册已搬迁的 `read_status`。

### 保留的关键协议和行为

命令名与注册顺序、Tauri plugin、`LoginState` 单实例、窗口 JSON 文件名与兼容 `maximized` 缺失的语义、托盘/关闭语义，以及 CLI 参数解析、中文用法文本和退出码均未改变。阅读状态算法未修改，仅改变模块路径。

### 自动化验证

| 命令 | 结果 |
| --- | --- |
| `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked` | 通过：library 18 项、CLI 0 项、desktop binary 0 项；原阅读状态 2 项现由 library target 运行。 |
| `cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked` | 通过。 |
| `cargo build --manifest-path src-tauri/Cargo.toml --bin toolbox --bin library_state_cli --locked` | 两个 binary 均通过构建。 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib --locked` | 18 项通过。 |
| 直接运行 `library_state_cli`（无参数） | 保留原中文用法提示，退出码为预期的 `2`。 |
| `git diff --check` | 通过。 |

### 人工验收与未覆盖项

- **blocked**：未启动桌面窗口，因此未手测旧窗口坐标/最大化恢复、单托盘图标、托盘恢复与关闭即退出；需要在可交互桌面会话执行。
- **未执行**：未让 CLI 对真实书库写入 read/unread 快捷方式，避免修改用户真实文件。
- 无新增自动化失败。首次 CLI 检查曾因包装脚本把预期退出码 2 视作 shell 失败；随后直接执行验证确认是预期结果，而非产品失败。

## R2：存储实现脱离命令层

### 实际变更

- 原 `commands/storage.rs` 的设置读取/写入、路径解析、SQLite 打开、完整性校验、迁移、备份和切换实现迁至根 `storage.rs`；没有改动 SQL、路径、文件名、清理或写设置的顺序。
- `commands/storage.rs` 仅保留三个带 `#[tauri::command]` 的协议入口并委托根实现；命令名和 DTO 未变化。
- 图书、Skill、NCM 的数据库 helper 改为直接调用 `crate::storage::open_database`，不再依赖 command 模块。
- 增加合成临时目录测试，验证 SQLite `integrity_check` 接受正常库、拒绝损坏字节文件，并在结束时清理该临时目录。

### 自动化验证

`cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked` 通过：library 19 项；`cargo check --all-targets --locked` 与 `git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：真实数据库迁移、选择已有库、备份文件与切换后再次打开，避免修改用户配置与数据库。
- **未覆盖**：当前迁移/切换操作仍以 `AppHandle` 为边界；本阶段只增加了完整性校验的合成 SQLite 测试，尚没有对设置写入失败、目标冲突、切换后新连接的独立自动化测试。该缺口必须在 R10 全量验收前补齐，不能据此声称迁移路径已端到端验证。

## R3：图书后端按职责拆分

### 实际变更

- `commands/library.rs` 仅保留原有 8 个 Tauri 命令入口；参数、DTO 和返回形状未变。
- `library/types.rs` 统一放置 `LibraryBook`、`MetadataUpdate`、`ImportResult`；`library/paths.rs` 管理书库/read/unread 根目录、规范化、归属校验和链接映射。
- `library/read_status.rs` 保留现有 Windows 快捷方式和阅读状态算法；`catalog.rs` 承担扫描时的快捷方式缓存与 read-state 冲突检测；`repository.rs` 保留原始建表/补列语句；`files.rs` 承担打开、改名、删除和移动导入。
- 文件操作仍遵循原执行顺序：先检查/更新快捷方式和文件，再更新 SQLite；未增加回收站、补偿、自动修复或数据库写入时机变化。

### 自动化验证

`cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked` 通过（19 项 library 测试）；`cargo check --all-targets --locked` 与 `git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：真实书库上的 COM 快捷方式读写、read/unread 双侧冲突、多链接冲突、UNC/verbatim 实际路径、跨盘移动失败、导入 partial 分类、重命名/删除后的真实文件状态；避免修改用户书库。
- 现有纯函数测试覆盖链接镜像路径、verbatim prefix 处理和改名扩展名/非法名称。临时书库与 SQLite 的完整端到端夹具尚未建立；这是一项明确测试缺口，R10 前需继续补充，不能用当前编译通过替代系统行为验证。

## R4：Skill 后端拆分

### 实际变更

- `commands/skills.rs` 仅保留六个既有 Tauri 命令入口及 DTO 重导出。
- `skills/types.rs` 维护 wire DTO；`manifest.rs` 原样保留简易 front matter 语法；`filesystem.rs` 管理 `~/.agents` 根、canonicalize、发现和删除归属校验；发现 `SKILL.md` 后不再扫描子目录的规则不变。
- `repository.rs` 承担原有 schema、描述、分类和成员事务 SQL；`service.rs` 仅编排扫描、路径校验和“先删目录、后删元数据”的操作顺序。
- 未启用 SQLite foreign keys、未更换 YAML 库、未修改 SKILL.md。

### 自动化验证

`cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked` 通过（19 项 library 测试）；`cargo check --all-targets --locked` 无编译告警；`git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：真实 `~/.agents` 目录扫描、实际 skill 删除、原生说明显示和分类关联级联行为；避免修改用户的 skill 目录与数据库。
- 现有测试覆盖 front matter 标量、折叠块和文本块。内存 SQLite 分类事务、大小写重名、成员去重和不存在 id 的独立测试仍待补充，必须在 R10 前列为测试缺口，而非假定无回归。

## R5：NCM 后端拆分

### 实际变更

- `commands/ncm.rs` 仅保留既有 13 项 NCM Tauri 协议入口；`LoginState` 仍是唯一的 Tauri managed state。
- `ncm/client.rs` 保留唯一复用 client 的超时、连接池、User-Agent 与请求路径；`auth.rs` 保留 Cookie 文件、内存状态和失效清理；`repository.rs` 保留下载记录 schema、COALESCE 和批量事务；`download.rs` 保留文件名、CDN 响应校验和流式写入。
- service 保持 QR、歌单、歌曲、播放 URL 和下载编排。下载完成后仍以 `spawn_blocking` 写记录，记录失败仍使命令失败；未引入 `.part` 或原子重命名。

### 自动化验证

`cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked` 通过（19 项 library 测试）；`cargo check --all-targets --locked` 无编译告警；`git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：真实网易云登录、在线播放 URL、CDN 下载和系统下载目录写入；不使用或读取任何真实登录会话。
- 现有离线测试覆盖 QR/登录 JSON、Cookie 合成、文件命名和 HTML/HTTP CDN 拒绝。空路径记录不覆盖真实路径、批量记录和代表性 DTO 序列化的专项 SQLite 测试仍需在 R10 前补充。

## R8：App、设置及确定重复的展示

### 实际变更

- `AppView` 保持收紧为 `'home' | 'settings' | ToolId`；页面依旧条件挂载，图书页最大宽度仍为 1280，其余页面仍为 900。
- 原 App 内的网易云标题/登录状态展示迁至 `plugins/ncm/NcmTool.tsx`，登录遮罩迁至 `plugins/ncm/NcmLoginDialog.tsx`；App 仍负责浮层开关和登录成功后的关闭时机，`NcmAuthProvider` 位置未变。
- 最后一次快捷下载 URL 已留在 `plugins/ncm/preferences.ts`，键名、默认值和读取/保存时机不变；`tools.ts` 不再承担持久化职责。
- 数据库命令 DTO 与三个 invoke 迁至 `toolbox/settings/api.ts`，文件选择、confirm、提示、迁移/切换状态迁至 `useDatabaseSettings.ts`；`SettingsPage.tsx` 仅组合展示。
- 两处相同的滚动监听、320px 阈值、固定定位样式和 smooth 回顶行为统一到 `shared/ui/BackToTopButton.tsx`。
- 确认首页未使用旧的 icon-size API 后移除死导出及相应测试；没有调用 `localStorage.removeItem`，既有 `toolbox_tool_icon_size` 用户键不会被删除或迁移。卡片尺寸行为和存储键保持。

### 自动化验证

`npm test` 通过：5 个测试文件、5 项通过；`npm run build` 通过（TypeScript 与 Vite）；`git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：桌面应用中的页面切换、首页快捷下载、QR 登录遮罩、真实文件选择器的取消/确认、真实数据库迁移和回顶交互；避免修改真实登录状态、数据库和系统文件。
- **未覆盖**：当前前端测试仅覆盖纯函数与持久化键契约，未使用浏览器/桌面测试框架验证 App 挂载/卸载、NCM 登录浮层、BackToTopButton 或系统对话框。R10 前应如实保留此人工验收缺口；不以构建通过替代这些端到端行为。

## R6：图书前端拆分

### 实际变更

- `LibraryTool.tsx` 现在只保留页面级状态、过滤/排序编排和弹窗开关；数据扫描、缓存优先与乐观保存仍由既有 `useLibrary` 按原顺序执行。
- 筛选与刷新控件迁至 `LibraryToolbar.tsx`；递归树、排序表头以及星级/阅读/描述行内编辑迁至 `LibraryTree.tsx`；改名和删除确认迁至 `BookDialogs.tsx`。
- 导入展示迁至 `ImportDialog.tsx`，拖放订阅、异步 unlisten 清理、DPI 坐标换算、预选目标、成功后的 refresh 回调和逐项错误显示迁至 `useLibraryImport.ts`。逻辑按原块移动，未变更导入 API 或完成回调时机。
- 返回顶部使用 R8 的共享组件；未增加防抖、保存并发控制、表单框架或扫描缓存策略。

### 自动化验证

`npm run build` 通过；`npm test` 通过：5 个测试文件、5 项通过（包括既有图书树纯函数测试）；`git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：桌面窗口中的真实书库扫描、元数据保存、阅读快捷方式切换、改名/删除、拖入文件夹/文件、不同缩放下的拖放命中与重复打开后的 listener 清理；避免改动用户书库。
- **未覆盖**：没有 React/Tauri 组件测试来直接验证星级动画、描述失焦、弹窗关闭时机、drag-drop listener 生命周期或 import partial 结果。现有 tree 测试仅覆盖纯树构建/筛选/排序；这些交互仍需 R10 的人工或新增自动化验收，不能由构建通过替代。

## R7：Skill 前端拆分

### 实际变更

- `SkillManagerTool.tsx` 只保留筛选、分类标签/右键坐标和创建/编辑/关闭状态，以及对 `useSkills` 的组合。
- 列表和自定义描述编辑移至 `SkillTable.tsx`；分类保存与搜索/勾选状态移至 `CategoryDialog.tsx`；右键遮罩、坐标定位及 Escape listener 移至 `SkillCategoryMenu.tsx`。
- 分类弹窗仍经 `saveSkillCategory` 保存，搜索不会清除已选项；保存失败仍回调到页面错误状态。删除的确认文本及“删除后 refresh”顺序仍由既有 hook 保持。
- 没有改动 Skill DTO、扫描/删除 API 或描述的失焦保存策略。

### 自动化验证

`npm test` 通过：5 个测试文件、5 项通过（包含既有 Skill filter 测试）；`npm run build` 与 `git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：实际 `~/.agents` 扫描、分类创建/编辑/删除、右键菜单的坐标/遮罩/Escape、描述编辑后失焦保存，以及真实 skill 删除；避免改动用户目录和数据库。
- **未覆盖**：没有组件测试直接模拟分类弹窗搜索勾选、Escape、菜单遮罩及确认删除。现有测试仅覆盖搜索纯函数；这些 UI 契约仍需 R10 的人工或进一步自动化验收。

## R9：NCM 前端整理与编排提取

### 实际变更

- `api.ts` 集中 NCM 下载记录和单曲下载的 Tauri 调用；删除 `store.ts` 和 `download.ts` 的转发层。`store.test.ts` 的占位断言替换为 `taskSelectors.test.ts` 的实际筛选、计数、分页断言。
- `playlist.ts` 集中完整页宽松 id 提取、快捷入口严格 URL 校验和 200 条分片；完整页仍在分片完成后回填 `vById`，快捷入口不取得该额外状态。
- CSV 移至 `csv.ts`；并发池和快捷入口的“成功、下载失败、记录回调失败”收集逻辑移至 `downloadQueue.ts`。为避免 Windows 不区分大小写与原展示组件重名，展示组件改为 `DownloadQueueView.tsx`，内容/行为不变。
- `taskSelectors.ts` 承担筛选、状态计数与分页，`useTaskFiltering` 继续维护 pageSize 100 和页面状态。
- 完整页不再直接写取消 ref 或失败任务状态，改调用 `useDownloadActions` 的 `cancelQueue` / `retryFailed`；批量、单曲、快捷弹窗仍保持独立的执行策略。
- 快捷下载的 URL、请求代次、解析/下载状态、关闭限制和提示文本移至 `useQuickDownload.ts`；`NcmQuickDownloadDialog.tsx` 仅保留展示。解析成功保存 URL、修改 URL 清除预览、关闭 invalidate、下载中拒绝关闭的原顺序保持。

### 自动化验证

`npm test` 通过：5 个测试文件、5 项通过；其中快捷下载测试继续覆盖 URL/分片、request gate 和同步 callback failure，新增任务选择器断言替换原占位测试。`npm run build` 与 `git diff --check` 通过。

### 人工验收与未覆盖项

- **未执行**：真实 NCM 登录、歌单解析、单曲/完整页批量/首页快捷下载、取消、CSV 下载和系统下载目录；避免联网、使用真实会话或写入用户下载目录。
- **未覆盖**：尚无可控 Promise/fake timer 测试证明完整页严格三并发、取消后已启动任务的继续重试，以及 500/1000ms 重试等待；也没有组件测试直接验证快捷弹窗。该缺口应在 R10 全量验收中继续保留或补齐，不能由当前纯函数和构建通过替代。

## R10：全量验收、CI 与文档同步

### 实际变更

- 新增 Windows `verify.yml`：Node 26.7.0 下执行 `npm ci`、`npm test`、`npm run build`、Rust all-targets test/check。原 `build.yml` 的 Node 20、签名、发布触发和 release 步骤未改。
- README 改为当前三个工具、Tauri-only 后端边界、真实本地数据位置、验证命令与重构后目录；不再声称 localStorage/前端 fallback、旧 `utils.ts`/`store.ts` 或不存在的示例数据。
- `todo.md` 标注为 2026-09-01 历史快照，并明确本次不修复其未勾选的独立行为问题。
- 审计确认 Rust command 文件共有 30 个 `#[tauri::command]` 入口；前端 invoke 均收敛到 feature API（设置 API、library API、skills API、NCM API），未发现 `#[path]` 源码包含。NCM 已不保留 store/download/utils 转发模块。

### 自动化验证

在 Node v26.7.0、Rust/Cargo 1.98.0 下执行并通过：

```text
npm test                                                    # 5 个测试文件通过
npm run build                                               # tsc + Vite 通过
cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked  # 19 个 library 测试通过；两个 binary target 通过
cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked # 通过
git diff --check                                            # 通过
```

### 人工验收与未覆盖项

- **blocked / 未执行**：未启动桌面窗口，故未手测窗口恢复、托盘、页面挂载/卸载、回顶、原生文件选择器、QR 登录、歌单下载、CSV 或更新安装。
- **未执行**：为保护用户数据，未操作真实 `toolbox.db`、`ncm_login_cookie.txt`、下载目录、`~/important/books` 或 `~/.agents`，也未验证真实 COM 快捷方式。
- **仍未覆盖**：数据库迁移/切换失败分支与新连接读取；图书 COM/导入 partial；Skill 分类事务/删除；完整页 NCM 三并发、取消和退避时序；前端组件交互。这些均在前述阶段记录，不能被本次全量编译替代。
