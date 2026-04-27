# learning-loop-reporter v0.5.0

## TL;DR

这是一个 **Breaking Change** 版本：`learning-loop-reporter` 不再自己扫描和组装候选数据，而是直接读取 `self-learning-loop` 生成的 daily report markdown，再把它适配成飞书纯文本消息。

## Why

v0.4.0 还在 reporter 内部理解候选库结构，职责太重，也把 reporter 和具体 runtime 数据布局绑死了。

v0.5.0 之后：
- `self-learning-loop` 负责生成日报 markdown
- `learning-loop-reporter` 只负责飞书通道
- 不同 runtime 只要能产出同格式日报，就能复用 reporter

## Breaking Change

- **依赖**：self-learning-loop **≥ v1.1.0-alpha.5**
- **CLI 变更**：`--event` → `--date` / `--report`
- **数据源变更**：不再直接读取 `learn/candidates/`，改读 `learn/reports/YYYY-MM-DD-daily.md`

> 旧 `--event` 参数已废弃；v0.5.0 中会报错并提示迁移命令。

## New CLI

```bash
learning-loop-reporter preview
learning-loop-reporter preview --date 2026-04-27
learning-loop-reporter preview --report ~/.openclaw/workspace/learn/reports/2026-04-27-daily.md

learning-loop-reporter notify
learning-loop-reporter notify --date 2026-04-27
learning-loop-reporter notify --report ~/.openclaw/workspace/learn/reports/2026-04-27-daily.md
```

## What changed

- 新增 `daily-report-loader`
- render 改成飞书消息适配器，不再自组装业务数据
- 自动跳过 `Run #N` 历史段
- 候选库快照表格在飞书里改为一句摘要
- 消息超 30k 字符时自动截断，并保留完整报告路径
- 测试全面切到 markdown fixtures + mocked send

## Validation

- 35 tests passed
- build passed
- `preview` 已验证 stdout
- `notify` 仅做 1 次真发验收（飞书预算严格 1 条）
