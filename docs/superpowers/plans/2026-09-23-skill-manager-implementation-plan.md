# Skill 管理实现计划

> `writing-plans` skill 在当前工作区不可用；此计划依据已确认的设计规格编写。

1. 新增 Rust `skills` command 模块：扫描 `%USERPROFILE%/.agents`，发现并解析 `SKILL.md` front matter，建立 SQLite 表，并实现元数据、分类和成员关系的 CRUD。
2. 在删除 command 中规范化根目录与目标目录，拒绝根目录外、符号链接越界、缺少 `SKILL.md` 或根目录本身；成功删除目录后以事务清理 SQLite 记录。
3. 注册 Tauri commands 并为扫描、front matter 回退、嵌套 skill 截断和路径验证添加 Rust 单测。
4. 新增 TypeScript API 和纯函数模块，封装 Tauri 调用与搜索匹配；为搜索行为增加 node:test 覆盖。
5. 新增 Skill 管理 React 页面：刷新、搜索、分类过滤、行内自定义描述编辑、分类管理对话框及二次确认删除。
6. 将工具注册到首页和 App 路由，并扩展现有工具注册测试。
7. 执行 `npm test`、`npm run build`、`cargo check`，修正报告的问题。
