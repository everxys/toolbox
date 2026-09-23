# Skill 管理工具设计

## 目标

在 Toolbox 中新增“Skill 管理”工具，用于扫描用户 `~/.agents` 目录中的 skills，并集中管理其自定义说明和逻辑分类。工具必须保留 skill 原有的 `SKILL.md` 内容不变；用户元数据由 Toolbox 自己持久化。用户可从可搜索、可多选的列表中为分类选择 skills，一个 skill 可以属于任意多个分类；删除 skill 前必须经明确确认。

## Skill 发现与身份

后端把 `~` 解析为当前 Windows 用户的 `%USERPROFILE%`，将扫描根目录固定为 `%USERPROFILE%/.agents`。递归扫描该根目录；每个直接包含 `SKILL.md` 的目录都是一个 skill，且该目录是此 skill 的唯一删除边界。扫描结果使用规范化绝对目录路径作为稳定身份。

每个 `SKILL.md` 的 YAML front matter 提供下列原生字段：

| 字段 | 来源 | 显示规则 |
| --- | --- | --- |
| 名称 | `name` | 缺失或无法解析时回退到目录名 |
| 原生说明 | `description` | 缺失时为空 |
| 路径 | skill 根目录 | 用于确认删除与排错，不作为主列表常规列 |

YAML front matter 缺失或不合法时，扫描仍应显示该 skill，并记录可面向用户展示的解析错误。一个目录只会被识别一次：发现 `SKILL.md` 后不再把其嵌套目录作为独立 skill 扫描。

## 持久化模型

继续使用应用数据目录下的 SQLite 数据库。原始 skill 文件不是数据库数据的写入目标。

| 表 | 关键字段 | 用途 |
| --- | --- | --- |
| `skill_metadata` | `skill_path`（主键）、`custom_description`、`updated_at` | 保存用户自定义描述 |
| `skill_categories` | `id`、`name`（唯一）、`created_at` | 保存逻辑分类 |
| `skill_category_memberships` | `category_id`、`skill_path`（联合主键） | 保存多对多关联 |

扫描完成后，保留已消失 skill 的用户元数据不作为正常列表项显示；当用户删除 skill 时，必须在同一删除流程中移除对应的 metadata 与所有 memberships。删除分类时只删除该分类及其 memberships，绝不删除 skill 或其他分类。

## 后端命令与安全性

新增独立的 Rust `skills` commands 模块，并注册下列职责：

1. `skills_scan`：扫描、解析 front matter，并合并元数据与分类；
2. `skills_update_metadata`：更新指定 skill 的自定义描述；
3. `skills_list_categories`：读取分类及关联；
4. `skills_save_category`：创建或更新分类名称与其完整 skill 勾选集合；
5. `skills_delete_category`：删除分类及关联；
6. `skills_delete_skill`：删除 skill 根目录并清理本地数据库记录。

所有会按路径操作的命令均在执行前规范化路径，并验证其严格位于规范化后的 `~/.agents` 根目录内。删除还必须确认目标目录本身含 `SKILL.md`。路径不存在、越界、符号链接跳转到根目录外或不再符合 skill 身份时，一律失败；不得删除外部文件。删除目录失败时返回明确错误，数据库清理仅在文件系统删除成功后执行。

## 界面与交互

在 Toolbox 首页增加“Skill 管理”工具入口。Skill 工具页包含：

- 顶部：刷新扫描、全局搜索、新建分类、分类筛选；
- 主列表：名称、原生说明、自定义描述、分类、删除操作；
- 自定义描述：行内编辑并保存到 `skill_metadata`；
- 分类：以标签显示，一个 skill 可展示多个分类；
- 加载/空状态/错误状态：扫描中禁用破坏性操作，根目录不存在或不可读取时提供清晰说明和重试。

“新建分类”与“编辑分类”共享一个模态窗口。窗口包含分类名称输入框、搜索框和可勾选的 skill 列表。搜索同时匹配名称、原生说明和自定义描述；勾选不受搜索过滤影响，保存时写入完整选择集合。分类名为空或与已有名称冲突时不允许保存。

点击删除 skill 时，打开二次确认对话框，展示 skill 名称和完整目录路径，并说明会删除整个 skill 目录及该 tool 中的自定义描述和分类关联。只有明确确认才调用删除命令；取消或失败时列表不改变，成功后重新扫描。

## 错误处理与边界

- `.agents` 不存在、不可读取或某个目录读取失败时，不执行写入或删除，并显示可行动的错误；
- `SKILL.md` 解析失败时不隐藏 skill，回退名称并显示解析状态；
- 分类保存失败时弹窗保留用户当前输入与勾选；
- 刷新后已不存在的 skill 不再列出，分类编辑器不会将它视为可选项；
- 任何前端传入路径都视为不可信，安全边界只由 Rust 后端验证。

## 验证

- Rust 单测：front matter 的正常/缺失/不合法解析，递归发现时的嵌套截断，分类多对多保存、受限路径验证与删除前身份验证；
- 前端单测：搜索匹配、分类勾选保留、工具注册；
- 执行 `npm test`、`npm run build` 与 `cargo check`。

## 非目标

本期不编辑 `SKILL.md` 原生说明、不安装远程 skills、不复制或导出 skills、不提供分类排序或批量删除。
