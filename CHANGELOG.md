# Changelog

## [0.3.0] - 2026-04-27 - Readability overhaul

### Added
- `src/domain-titles.ts`：domain → 中文标题映射、`titleForCandidate()`、`shortId()`
- `src/sections/` 程序化 section 渲染：overview / new-candidates / dropped / cumulative / actions
- `fixtures/rich.json` / `empty.json` / `errors-only.json` / `compatibility-old.json`
- `preview --fixture <name>`：开发期直接预览内置样例
- `preview --raw`：输出组装后的 JSON 结构供排查
- 41 个测试用例，覆盖标题策略、section、render snapshot、CLI 和发送逻辑

### Changed
- 新候选展示改为 3~4 行紧凑卡片：标题 / 触发 / 说明 / 短 ID
- 候选标题优先级改为：summary → 中文 domain → 原始 domain → 短 ID
- dropped 段从“聚合 + 前 3 条”双层结构改为单层 emoji 分组
- 重复命令从每条候选中移除，统一收口到「现在该做什么」段
- 每段统一使用 `═══ {title} ═══` 分隔，适配飞书等宽阅读
- README 示例升级为 v0.3.0 新版版式
- `cli.ts` 改为可测试入口 `runCli()`

### Removed
- 删除 `templates/daily-report.tmpl`，彻底弃用模板字符串渲染

## [0.2.0] - 2026-04-27 - Three-section daily report

### Added
- **三段式日报**：指标（📊）+ 内容（🆕/⚠️）+ 行动（🔥/📁）
- **候选 summary 展示**：每条新增候选显示 1-2 句人话总结
- **trigger_event 展示**：显示触发候选的事件摘要
- **dropped 候选详情**：按原因聚合 + 前 3 条具体内容
- **高分待审 backlog**：≥ 0.7 置信度 pending 候选，超 4 天标 ⚠️
- **age_label 计算**：今日新增 / N 天未审 / ⚠️ N 天未审
- `preview --raw` 输出原始 JSON 数据
- 候选数据从 SQLite DB + markdown frontmatter 双路加载
- 兼容 v1.0 事件（无 dropped_summary/dropped_items/new_candidate_ids）
- render.test.ts 13 case + send.test.ts 4 case

### Changed
- render.ts 完全重写：从 mustache-lite 模板引擎改为程序化渲染
- cli.ts 适配新 render API
- 模板文件保留为参考，实际渲染由 renderFromData() 驱动

### Breaking
- `renderTemplate()` 函数移除，改用 `renderReport()` / `renderFromData()`

## [0.1.0] - 2026-04-27 - Initial release

### Added
- CLI: `notify`, `preview`, `health` 三个命令
- Mustache-lite 模板渲染引擎
- 飞书推送（通过 `openclaw message send`）
- 事件归档（推送成功后自动 mv 到 `events/processed/`）
- 默认日报模板 `templates/daily-report.tmpl`
- `scripts/setup.sh` 一键安装
- 完整测试覆盖（render 模块）
