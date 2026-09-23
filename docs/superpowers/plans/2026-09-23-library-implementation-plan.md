# 图书馆工具实施计划

**Design:** `docs/superpowers/specs/2026-09-23-library-design.md`  
**Scope:** Windows Tauri desktop application; book roots resolve from the active user's home directory.

## 1. 建立纯数据逻辑与测试

新增 `src/plugins/library/types.ts`、`tree.ts` 和对应测试。

- 定义 Tauri DTO：图书元数据、扫描结果、目录树节点、筛选器、排序配置和操作结果；
- 实现前端纯函数：标题提取、目录树过滤、保留必要父节点、每个目录内的稳定排序；
- 覆盖空树、嵌套目录、星级/已读/类型/有描述筛选、全文搜索和各字段排序。

验收：`npm test` 能独立验证目录层级不会在排序或筛选时被打散。

## 2. 后端图书馆领域模块与数据库

新增 `src-tauri/src/commands/library.rs`，并在 `commands/mod.rs` 中导出。

- 通过 `std::env::var_os("USERPROFILE")` 或用户主目录 API 解析 `~/important/books/{Library,read,unread}`，不写死用户名；
- 在 `app_data_dir` 下打开 SQLite，执行 schema migration，创建 `library_books` 表；
- 递归扫描 Library，忽略目录和应用数据库文件，使用规范化绝对路径作为记录 key；
- 以路径为键读写优先级、类型、描述，清除不再存在的原书记录；
- 返回完整书籍扁平结果加相对路径，供前端重建树，避免将 UI 状态持久化到后端。

验收：Rust 单测覆盖 home 路径推导、标题去扩展名、数据库默认/更新/清理与路径范围校验。

## 3. 安全的 Windows 快捷方式与文件操作

在 `library.rs` 中实现快捷方式服务；若需要较小的专用 crate，优先使用 Windows COM Shell Link API，否则使用受限的 PowerShell 调用。

- 枚举 `read` / `unread` 下的 `.lnk` 并解析目标，忽略失效目标及 Library 外目标；
- 将 Library 相对路径映射为状态快捷方式位置，例如 `Library/灌篮高手/1.pdf` ↔ `read/灌篮高手/1.lnk`；
- 状态迁移时按需创建目标父目录，生成或移动 `.lnk`，再从源状态目录向上清理空目录但绝不删除状态根；
- 同时存在 read/unread 快捷方式时返回冲突错误；
- 打开调用 Windows 默认关联程序；删除前再次校验所有目标都在允许范围，随后删除原书、两处快捷方式、空的快捷方式父目录和数据库记录。

验收：在 `tempdir` 测试夹具里验证镜像目录、目录清理、冲突、失效链接、外部路径拒绝和不会删除 Library 外文件。

## 4. 公开 Tauri commands 并接入应用

扩展 `src-tauri/src/main.rs` 的 `use` 和 `generate_handler!`。

暴露最小 API：`library_scan`、`library_update_metadata`、`library_set_read_status`、`library_open_book`、`library_delete_book`。所有 mutation command 输入原书路径并在后端二次校验路径范围；操作结果返回刷新后的单书状态或清晰错误。

更新 `src/toolbox/tools.ts`：将 `ToolId` 扩展为 `library`，添加“图书馆”卡片定义并调整 quick-action 类型，使没有快捷操作的工具可正常渲染。为工具注册相关纯函数补充测试。

验收：`cargo check` 通过，前端可 invoke 全部命令而无需向 UI 暴露绝对路径之外的文件系统能力。

## 5. 构建图书馆 React 页面

新增 `src/plugins/library/api.ts` 和 `LibraryTool.tsx`，必要时拆出 `LibraryToolbar.tsx`、`LibraryTree.tsx`、`BookRow.tsx` 与 `ConfirmDialog.tsx`。

- 首次挂载和用户点击刷新均调用扫描 command，显示加载、空态、错误与重试；
- 工具栏实现搜索、星级、阅读状态、类型、仅有描述和排序；
- 目录树支持单独展开/折叠，筛选后只渲染命中书及父目录；
- 行内提供星级选择、已读勾选、类型输入、可展开长描述编辑，以及打开/删除；元数据保存失败时恢复编辑值并提示；
- 已读切换与删除均先显示带图书标题和影响说明的确认框，确认后再 invoke；成功后刷新或局部更新，失败后保持原 UI 状态；
- 使用语义化按钮、标签和 aria 属性，保证键盘可操作。

验收：前端测试覆盖确认前不发 mutation、取消会保留状态、失败回滚；在开发版中能完整浏览和编辑真实目录。

## 6. 路由、样式与回归验证

更新 `src/App.tsx`，添加 `library` 视图分支并从主页打开；使用现有 `ToolPageShell` 与导航视觉风格。不要修改用户现有的 VPN/NCM 未提交变更。

执行：

1. `npm test`
2. `npm run build`
3. `cargo check --manifest-path src-tauri/Cargo.toml`
4. 在真实 `~/important/books` 进行只读扫描检查；仅在用户可见的确认对话框后手工验证一次状态迁移和删除。

报告新增文件、验证结果和任何因 Windows Shell API 差异产生的限制。
