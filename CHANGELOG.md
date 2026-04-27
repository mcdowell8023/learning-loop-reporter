# Changelog

## [0.5.0] - 2026-04-27 - Read daily report markdown instead of assembling data

### Added
- `src/loaders/daily-report-loader.ts`：直接读取 `~/.openclaw/workspace/learn/reports/YYYY-MM-DD-daily.md`
- `preview [--date YYYY-MM-DD] [--report <path>]`：本地直接预览飞书文本
- `notify [--date YYYY-MM-DD] [--report <path>]`：按日期或指定 markdown 推送
- 4 份新的 markdown fixtures：`sample-daily-report.md` / `empty-day.md` / `with-stale.md` / `with-dropped.md`
- 35 个测试用例，覆盖 loader / render / CLI / send，全程 mock 发送

### Changed
- reporter 从“自己组装候选数据”切换为“读取 self-learning-loop daily report markdown 再适配飞书消息”
- render 只保留飞书适配职责：保留标题层级、移除 Run 历史、压缩候选库表格、超长文本 30k 截断
- `health` 自检从 candidates 目录改为 daily reports 目录
- 现在 reporter 是 self-learning-loop 的飞书通道，跨 runtime 更友好

### Removed
- 删除 `candidate-loader` 及相关测试
- 删除 `src/sections/*` 的程序化组装逻辑
- 删除旧的 `--event` / `--fixture` / `--raw` 工作流（v0.5.0 起不再支持）

### Breaking
- **Breaking Change**：数据源改为 self-learning-loop ≥ `v1.1.0-alpha.5` 产出的 daily report markdown
- CLI 参数由 `--event` 切换为 `--date` / `--report`
- reporter 不再直接读取 `learn/candidates/` 目录

## [0.4.0] - 2026-04-27 - Real candidate-store compatibility

### Added
- `src/loaders/candidate-loader.ts`：按真实目录结构加载 `learn/candidates/YYYY-MM-DD/*.md`
- `gray-matter` 依赖：解析 markdown frontmatter
- `age_days` / `short_id` / `filepath` 等派生字段
- `trigger_conditions` / `recommended_action` 正文段落抽取
- `fixtures/rich-real.json`：面向真实 6 候选库的 fixture
- `src/loaders/candidate-loader.test.ts`：11 个 loader 场景回归

### Changed
- render 数据模型从旧版 `confidence/domain/summary` 假设切换到真实 `problem_category/state/created_at` 结构
- 候选标题改为 `problem_category -> 中文标题 -> humanized title`
- backlog 从“高 confidence 候选”改为“超期未审候选”
- 新候选卡片展示从 `conf N` 改为 `N 天前`
- 新增 `⏰ 超期未审 (≥N 天)` 段
- `reporter-config.json` 支持 `stale_days`
- CLI `preview --raw` 输出新版 `ReportData`
- README 示例与说明同步到 v0.4.0
- 测试基线更新为 48 case

### Removed
- 删除 reporter 内部对 `confidence` 的硬编码 fallback 语义
- 删除动作区里 `--min-conf 0.7` 的旧命令假设
