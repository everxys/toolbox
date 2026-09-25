# Toolbox 重构实施任务包

日期：2026-09-25  
配套约束：[重构设计](../specs/2026-09-25-toolbox-refactoring-design.md)  
状态：待执行。本文列出的代码、测试和 CI 修改都尚未实施。

## 1. 执行入口

交给执行 agent 的总指令：

> 请先阅读本计划和配套设计，检查当前 git status 与最新源码。目标是保持现有行为的渐进式重构，不做额外功能或第 9 节列出的行为修复。先执行 R0，然后按依赖执行获分配任务。保留已有未提交改动，不重置工作区。命令名、参数、数据格式、文件路径、数据库 schema、交互时机必须保持。每个任务分别报告改动、验证、未覆盖项目、遗留风险；没有证据不能声称“功能完全无影响”。

执行前必须知道：设计基于 HEAD `3b9f993` 与当时的工作区，不是仅基于该提交。已有 `commands/read_status.rs` 提取和 CLI 修改；先整合这组内容。隔离 worktree 不能自动获得未提交文件，创建隔离环境时必须明确包含/移交这组变更，不能仅 checkout HEAD 开始重构。

不要求一次性执行全部；每个任务交付时项目必须仍能构建运行。若只有一个 agent，按本计划顺序执行。多个 agent 的分工只是可选交接安排，不要求运行中的 agent 自动另开任务或委派。

## 2. 依赖与批次

```text
R0 基线与契约
 ├─ R1 Rust library/桌面装配 → R2 存储实现迁移
 │                            ├─ R3 图书后端
 │                            ├─ R4 Skill 后端
 │                            └─ R5 NCM 后端
 ├─ R6 图书前端
 ├─ R7 Skill 前端
 └─ R8 App/设置与公共展示

R5 + R8 → R9 NCM 前端整理
R2～R9 → R10 全量验收与文档/CI 收尾
```

R9 等 R5 是推荐顺序，便于复核下载协议；技术上命令保持不变后两者可独立。R8 与 R6/R7 都涉及 BackToTopButton 时，先由 R8 创建公共展示文件，R6/R7 再接入，或最后由 R8 单独接入，避免同时改相同文件。

建议评审提交颗粒度：R0 一个；R1/R2 各一个；R3 按“阅读状态/快捷方式”和“目录/文件/SQL”分两个；R4 一个；R5 按“认证/HTTP”和“下载/SQL”分两个；R6/R7 各按“格式展开”和“拆分接入”分两个；R8 一到两个；R9 按“数据/纯计算”和“队列/快捷弹窗”分两个；R10 一个。这是审查单元建议，不要求替用户自动提交或发布。

## 3. 通用验证命令

从仓库根目录运行：

```powershell
git status --short
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked
cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked
git diff --check
```

上述命令不会替代 UI/Windows 系统验收。每个局部任务执行相关测试和受影响构建即可，全量组合由 R10 执行。R1 增加 lib target 后必须验证主 binary 和 CLI，不只 cargo test --lib。

格式工具仅用于正在拆分的文件；原仓库有大量压缩代码，不能把全库格式差异作为本轮任意任务的附带输出。不添加“整个仓库立即零 lint 告警”的门槛。

## R0. 固定当前行为并建立执行记录

**目的**：让后续 agent 知道兼容对象、已有变更归属及验证缺口。

**文件范围**：现有测试、验证记录、新的临时夹具工具（如确有需要）。不修改业务实现。

**步骤**：

1. 保存当前 HEAD、git status、相关已改文件的差异摘要；把用户已有变更与本次执行变更区分开。不要把真实 Cookie/数据库内容写进报告。
2. 重跑本计划第 3 节命令，记录工具版本。验证 5 个前端测试文件确实被发现，识别 `store.test.ts` 只是占位断言。
3. 核对设计第 4 节的 30 个命令与 frontend invoke 负载，记录代表性 JSON fixture。可以静态审查注册列表；不要把脆弱源码文本匹配测试当成命令协议测试。
4. 记录三种下载流程策略矩阵，给 URL 校验、分片、重试/取消等现有可测试接口补关键行为断言。
5. 准备临时目录/SQLite 样本：旧版 library_books（无缓存列）、当前表结构、中文空格文件名、损坏数据库、同名冲突。夹具只用合成数据。
6. 建立 `docs/refactoring/2026-09-25-validation.md`（执行阶段新建），记录每任务的测试与人工验收结果。

**验收**：已知基线失败单独记录；不能把失败归咎于未实施的重构。依赖测试入口尚未解耦的场景列为所属任务验收，不为测试先发明大型 mock 框架。

**交接**：精确列出正在进行的用户改动；如果工作区在调研后变化，附新旧行为差异，后续 agent 依据更新后的约定执行。

## R1. 建立 Rust library target，提取桌面装配

**目的**：主程序和 CLI 正常复用 Rust 模块，解除按源码路径包含。

**文件范围**：`main.rs`、新增 `lib.rs`/`desktop.rs`、`commands/mod.rs`、CLI、原 `commands/read_status.rs` 的搬迁；不修改阅读状态算法。

**步骤**：

1. 机械迁移：Builder 和模块声明移入 `lib.rs::run()`，main 保留 release Windows subsystem 属性并调用 run。
2. 将 SavedWindowState、save/restore、托盘创建及关闭回调放入 desktop。Builder 继续持有插件/状态/命令注册。
3. 创建 `library/mod.rs` 与 `library/read_status.rs`，把当前未提交 read_status 实现原样迁入，向 CLI 只公开 set_read_status。此时 paths/shortcuts 尚不拆，是临时但可运行的中间状态。
4. 让旧 `commands/library.rs` 从 crate::library 的 crate-visible helper 获取实现；CLI 改为 toolbox::library::set_read_status。
5. 移动现有测试并修正相对 include_str 路径。确保 LoginState 仍是唯一 managed state，调用点类型一致。

**验收**：两个 binary 都能构建；CLI 参数/退出码保持；旧窗口 JSON 测试通过；单托盘测试通过；桌面启动/关闭手测通过。此任务不调用 CLI 去改真实图书状态。

**回退**：只回退本任务搬迁；保留迁移前用户 read_status 提取内容。

## R2. 存储实现脱离命令层

**目的**：各功能统一依赖实际 storage 实现，保持切换数据库能力。

**文件范围**：新增 `src-tauri/src/storage.rs`，精简 `commands/storage.rs`，lib 模块声明，三个功能的 storage import。

**步骤**：

1. 将 settings、路径解析、数据库打开、迁移、校验、备份移到根 storage.rs；保留三个命令入口和原始负载。
2. 内部方法接受 app data 路径；入口通过 AppHandle 解析。根据当前调用顺序检查目录创建及错误提示，没有必要的路径解析不提前执行。
3. 三个功能数据库 helper 改调用 crate::storage，不再依赖 commands::storage。
4. 用临时 SQLite 文件覆盖迁移/切换及失败路径，特别验证“下一次 open 读取新配置”。
5. 不变更各功能建表策略，不添加 SQLite pragma 或连接缓存。

**验收**：目标已有文件时不覆盖；切换同一路径行为一致；坏库不改配置；成功迁移源库保留；switch 备份存在；新连接读取目标数据。

**回退**：代码回退不自动回迁用户数据库；由于此阶段仅测试临时目录，应没有需要迁回的真实数据。

## R3. 图书后端按职责拆分

**目的**：把扫描、SQLite、书籍文件和快捷方式规则分开，但保留操作顺序。

**文件范围**：`library/*`、`commands/library.rs`、必要 lib 声明与测试。依赖 R1/R2。

**步骤**：

1. 从 read_status 提取 paths 与 shortcuts，添加 BooksPaths 的生产构造和测试构造。移除跨模块大规模 pub helper；只保留实际调用所需可见性。
2. read_status 保留独立 `set_read_status_at(&BooksPaths, path, read)`，对外 set_read_status 只负责取生产路径。
3. 从 commands/library 提取 repository，保持 CREATE/ALTER/INSERT/SELECT 原句和执行时机；SQLite helper 接受具体 Connection。
4. 提取 catalog 的扫描、read_state_map、cached 读取与 stale 清理。cache miss 时才解析快捷方式的规则不变。
5. 提取 files 中 rename/delete/import/open，并把路径/命名纯规则放 paths。不要改成先更新数据库或先删原书。
6. 命令层仅保留参数、取得路径/连接和功能调用。校验命令 JSON 和错误字符串未变化。
7. 增加临时书库/COM/SQLite 测试；扫描序列、路径 canonicalize、UNC 与 verbatim prefix 要覆盖。

**重点验收**：

- 同一本书 read/unread 两侧均有链接时仍报错；同一 source 多链接仍拒绝；目标同名指向别书仍拒绝。
- 同名文件导入不覆盖；移动失败不丢源文件；创建快捷方式失败保持原 partial/整体失败分类。
- 改名后扩展名、相对路径、元数据保留；当前 read_state 由下一次 scan 刷新。
- 删除及扫描 stale 清理按现有语义进行；不能在本任务加入自动修复、回收站、回滚补偿。

**交接**：给出文件系统→快捷方式→数据库的真实执行顺序和所有观察到的部分失败情形。

## R4. Skill 后端拆分

**目的**：解析规则可独立测试，扫描和数据访问职责清楚。

**文件范围**：新增 `skills/*`、精简 `commands/skills.rs`、lib 声明与本功能测试。

**步骤**：

1. manifest.rs 原样提取当前简易 front matter 解析；不要换 YAML 库，不扩展/收紧语法支持。
2. filesystem.rs 提取 ~/.agents 根、扫描、canonicalize 和 validate_skill_path；保留发现 SKILL.md 后不向下遍历的行为。
3. repository.rs 提取描述、分类、成员查询及事务；mod.rs 保留操作编排。
4. 命令保持六个入口和旧 DTO；自定义描述只写 SQLite。
5. 内存 SQLite 验证分类事务、去重、重名、不存在 id；临时目录验证扫描和删除归属规则。

**验收**：原生说明显示一致，SKILL.md 不被修改；名称 COLLATE NOCASE 约束保持；删除 skill 的先删目录再删元数据顺序不变。分类关联级联疑点先重现并记录，不在本任务偷偷启用 foreign_keys。

## R5. NCM 后端拆分

**目的**：集中 HTTP、登录、下载与记录；消除 command 调 command。

**文件范围**：新增 `ncm/*`、精简 `commands/ncm.rs`、lib 中 LoginState 注册路径及测试。

**步骤**：

1. 先迁 DTO 与 client：保留当前 JSON fallback、URL 路径、Referer、Cookie 合成、连接复用与超时参数。
2. auth.rs 提取 LoginState、Cookie 路径/读写/清理及登录校验。明确共享的 LoginState 类型不因重导出复制。
3. repository.rs 提取 ncm_downloads 建表、list/mark/mark_many/record；保持 COALESCE 和批量事务。
4. download.rs 提取命名规则、CDN 判定、流式写入；command 的取播放地址和下载复用 client 函数。
5. SQLite 写入仍置于 spawn_blocking，不能持有 Mutex 或 rusqlite 借用跨 await。
6. 原 9 项 NCM Rust 测试随职责迁移；补空路径 mark 不覆盖真实 path、批量记录、代表性 DTO 序列化测试。

**验收**：命令名/JSON/目录/文件名不变；下载记录失败仍使当前 ncm_download 返回错误；当前不引入 .part 文件和原子重命名策略；无客户端重复创建回退。

**联网验证**：只在用户已有可用会话和合适测试曲目时检查真实链路；不能联网时列为 blocked，不影响离线契约检查的真实性。

## R6. 图书前端拆分

**目的**：阅读页面代码时能够区分状态、表格、编辑与导入生命周期。

**文件范围**：`src/plugins/library/*`，必要时接入已有 shared BackToTopButton。

**步骤**：

1. 单独展开 LibraryTool.tsx 的长行 JSX 和多语句行；核对纯格式化 diff。
2. 把业务数据类型移到 types.ts；tree.ts 只保留计算及必要内部类型导入。
3. 提取 useLibrary：先保持代码块内部操作顺序和 catch/finally 逻辑，再替换页面调用。收窄元数据 patch 类型。
4. 提取 LibraryTree、Toolbar、BookDialogs；树内部的小行编辑器可留同文件。
5. 提取 ImportDialog/useLibraryImport，逐条验证 listener 异步清理、DPI 坐标、预选和完成回调。
6. 接入 BackToTopButton；若 R8 未完成，暂留原实现，交由 R8 后续接入。

**验收**：缓存到扫描顺序、筛选/三态排序、折叠 key、星级动画/归零、描述失焦保存、改名/删除关闭时机、导入命中和重复打开清理全部一致；既有 tree 测试保留。

**禁止附带**：自动防抖保存、新增扫描缓存策略、并发保存修复、通用表格、通用表单框架、全部内联样式迁移。

## R7. Skill 前端拆分

**文件范围**：`src/plugins/skills/*`，必要时接入已有 BackToTopButton。

**步骤**：

1. 先只展开格式，再把 DTO 移入 types.ts，api.ts 只保留 invoke。
2. useSkills 拥有数据、加载、失败状态、刷新和持久化操作；页面保留筛选、右键菜单坐标、弹窗状态。
3. 分离 SkillTable、CategoryDialog、CategoryMenu。DescriptionEditor 暂留 SkillTable 内。
4. 用创建/编辑/关闭的局部联合类型替换 undefined/null 双重状态；保持原渲染和关闭语义。
5. CategoryDialog 经回调保存，不直接 invoke；保持搜索不清空 selected、save 时错误由页面展示。

**验收**：空态/加载/错误互斥关系不变；菜单 Escape/遮罩、右键坐标、分类搜索勾选、保存后刷新、删除确认文本和调用顺序一致；原 filters 测试通过。

## R8. App、设置及确定重复的展示

**文件范围**：App、toolbox、NCM 新增入口/登录浮层/preferences、shared/ui；不同时重写 NCM 下载内部。

**步骤**：

1. AppView 类型收紧，删除 any；现有条件渲染调整为可读结构，保留页面挂载范围和宽度。
2. 移出 NcmToolHeader 和登录弹窗到功能内；App 保留导航和浮层开关，NcmAuthProvider 位置不变。
3. 最后一次 NCM URL 移入 preferences，更新 tools.test 相应导入并按职责拆测试；保留 localStorage key/默认值/保存时机。
4. settings/api.ts 提取三个数据库命令和 DTO，useDatabaseSettings 提取操作/页面状态，页面保留展示。
5. 创建 BackToTopButton，沿用两处相同阈值、样式、scroll 监听和 smooth 行为；负责与 R6/R7 协调最后接入。
6. 检查 home.ts 旧 icon-size 导出：仅当确认除测试外无调用时删除死导出和对应无效测试；不删除用户存储键，不建立迁移任务。卡片尺寸路径继续测试。

**验收**：导航、快捷动作、登录浮层、settings 文件选择/confirm/cancel、返回顶部一致；App 不包含 NCM 登录展示细节；工具元信息不依赖持久化逻辑。

## R9. NCM 前端整理与编排提取

**目的**：共享真正相同的部分，隐藏队列内部状态，不抹平不同入口行为。

**文件范围**：`src/plugins/ncm/*`；R8 已管理 App、preferences，不再同时编辑这些文件。

**步骤 A：调用与计算集中**

1. invoke 集中在 api.ts，把 store.ts 的数据访问和 download.ts 中单次 invoke 迁入；调用迁完删除纯转发文件。
2. playlist.ts 收拢两种 URL 解析和 200 条分片。完整页保持 vById 回填与状态更新时间，快捷页保持当前行为。
3. taskSelectors.ts 共享计数和可独立测试的筛选；保留 pageSize 100、搜索规则、skipped 分母语义。
4. CSV 放 csv.ts，pool 随后移 downloadQueue.ts；更新当前使用 .ts 显式扩展名的 Node 测试导入，保证 Node 与 tsc 都能解析。

**步骤 B：完整页队列**

1. 提取整个批量循环而非重新设计通用 queue engine；生产接口仅需任务、音质、并发及必要回调/依赖。
2. 用可控下载 Promise 检验三并发、取消时已经启动任务继续重试、500/1000ms 延时和最终状态。
3. useDownloadActions 返回 cancelQueue、retryFailed、downloadAllUndownloaded、downloadTrack、markFromThisTrack；内部维护 cancelRef 和 tasks 更新。
4. 页面按钮调用动作，不直接改 ref/状态。单曲/快捷的单次策略独立保留。

**步骤 C：快捷弹窗**

1. 把状态和请求 gate 移入 useQuickDownload，不改 effect 重置依赖与状态转换。
2. 解析完成保存 URL、修改 URL 清预览、关闭 invalidate、下载中禁止关闭都保持。
3. 迁移 quickDownload.test，保留同步 callbackFailures 的现有断言。Promise 记录失败问题只写入遗留清单。

**验收**：设计第 4.3 节逐格相同；异步计时用 fake 不真实等候；导出 CSV 和 UI 操作手测一致；批量下载无需增加新的运行时依赖。

**回退策略**：A/B/C 各自独立评审。若 B 无法证明时序一致，保留已完成的 A 和 C，将 B 的重写撤回到机械提取版本，不能以“更合理”为由改变策略。

## R10. 全量验收、CI 与文档同步

**文件范围**：验证记录、README、必要测试配置、验证 workflow；小范围清理确定无调用的临时转发。

**步骤**：

1. 执行第 3 节完整验证命令；检查 30 个命令、两个 Rust binary、所有测试文件被发现。
2. 对设计第 7.2 节人工检查逐项记录结果。失败项定位到本次回归或原有问题；无法运行的项目明确 blocked。
3. 检查迁移遗留：#[path] 源码包含、页面内 invoke（平台 UI 订阅除外）、多余 store 转发、unused imports、any、循环依赖、公开面扩散。
4. 增加 Windows PR 验证 workflow：npm ci、npm test、npm run build、cargo test/check --all-targets --locked。使用本次实际验证过的 Node 26.7.0 作为明确初始版本；如果执行环境换版本，先完整验证再固定，不凭 README 的 Node 18+ 推断兼容。
5. 当前发布 workflow 用 Node 20 且不跑 tests；本次验证 workflow 不自动发布。发布 workflow 的触发条件、签名和 release 步骤保持。是否同步其 Node 版本作为单独可审查配置变更，不借重构改发布语义。
6. 不更换测试框架；本机 Node 26.7.0 的现有 glob 已发现全部 5 个文件，CI 必须验证新增/迁移后的测试也被发现。若 CI shell 的展开不同，只修正测试入口枚举，不换框架解决路径问题。
7. README 更新当前三个工具、SQLite 真源、Tauri-only 后端、Windows 系统依赖、CLI、测试命令和新目录图；历史 specs 保留，不伪造为已经按旧方案实施。
8. todo.md 中已过时状态以说明形式校正，结构成果与独立 bug 清单区分；无证据不勾选完成。

**完成交付格式**：

```text
任务范围/基线：
实际变更：
保留的关键协议和行为：
自动化验证（命令、版本、结果）：
人工验收（逐项 pass/fail/blocked）：
与原方案的偏差及依据：
原有问题与新增回归分别列出：
下一任务需要知道的接口与文件归属：
```

## 4. 多 agent 文件归属约定（用户选择多 agent 时）

| 负责人任务 | 专属文件 | 不应顺手修改 |
|---|---|---|
| 基础整合 R1/R2/R8/R10 | lib/main/desktop/storage、App、toolbox、shared、workflow、README | 图书/Skill/NCM 的内部业务实现 |
| 图书 R3/R6 | Rust library、commands/library、前端 library | 全局命令注册/数据库迁移实现 |
| Skill R4/R7 | Rust skills、commands/skills、前端 skills | library 路径帮助函数；不能跨功能导入以减少几行重复 |
| NCM R5/R9 | Rust ncm、commands/ncm、前端 ncm（扣除 R8 尚在编辑的入口文件） | App、公共设置和发布配置 |

lib.rs/commands/mod.rs 的注册修改由基础整合任务集中处理；其他任务交付明确的新增声明/导出需求。没有公共接口冻结前不要并发重命名共享文件。并发任务完成后，整合任务负责重新运行全量验证，不能只拼接各 agent 的“测试通过”报告。

## 5. 停止扩大范围的规则

- 发现行为问题时先写进设计第 9 节的后续清单，不为完成“重构”改用户交互。
- 如果新模块只是把参数原封不动传给另一个新模块，且不承担 Tauri/系统/数据库适配职责，合并这一层。
- 不按文件行数硬拆；一个文件专注一个可解释职责即可。短控件、DTO、局部 helper 可以共处。
- 不以生成更多目录、hooks、类或测试数量作为进度。应能回答“修改这个功能的规则，现在是否只需看一两个明确文件”。
- 测试或人工验收出现回归时，停下后续扩展并修复或回退当前任务；不拿新架构合理性替代行为兼容。
