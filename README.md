# learning-loop-reporter

> self-learning-loop 的飞书通道适配器

从 **v0.5.0** 开始，`learning-loop-reporter` 不再自己扫描候选库、组装日报数据；它只做一件事：

**读取 `self-learning-loop` 生成的 daily report markdown，然后转成适合飞书发送的纯文本消息。**

## 架构

```text
self-learning-loop reflect
  ↓
~/.openclaw/workspace/learn/reports/YYYY-MM-DD-daily.md
  ↓
learning-loop-reporter preview / notify
  ↓
stdout / Feishu
```

这意味着：
- reporter 只是一个 **通道层**
- 数据真相源是 `learn/reports/*.md`
- 不安装 reporter，你也可以直接 `cat` 报告文件阅读
- 对 opencode / claude-code 用户尤其友好：**不需要装 reporter 也能消费日报**

## 依赖

- self-learning-loop **≥ v1.1.0-alpha.5**
- openclaw CLI（仅 `notify` 需要，用于发飞书）

## 安装

```bash
git clone https://github.com/mcdowell8023/learning-loop-reporter.git
cd learning-loop-reporter
npm install
npm run build
bash scripts/setup.sh
```

安装后：
- `~/.local/bin/learning-loop-reporter` — CLI
- `~/.openclaw/workspace/skills/learning-loop-reporter/SKILL.md` — Skill 定义
- `~/.openclaw/workspace/learn/reporter-config.json` — 推送配置

## 配置

编辑 `~/.openclaw/workspace/learn/reporter-config.json`：

```json
{
  "channels": [
    { "type": "feishu", "target": "ou_your_open_id" }
  ]
}
```

## CLI

### 预览

```bash
# 默认读取今天（Asia/Shanghai）对应的日报
learning-loop-reporter preview

# 指定日期
learning-loop-reporter preview --date 2026-04-27

# 指定任意 markdown 报告路径
learning-loop-reporter preview --report ~/.openclaw/workspace/learn/reports/2026-04-27-daily.md
```

### 发送

```bash
# 默认发今天日报
learning-loop-reporter notify

# 指定日期
learning-loop-reporter notify --date 2026-04-27

# 指定任意 markdown 报告路径
learning-loop-reporter notify --report ~/.openclaw/workspace/learn/reports/2026-04-27-daily.md
```

### 自检

```bash
learning-loop-reporter health
```

## Deprecated / Breaking Change

v0.5.0 是 **Breaking Change**：

- `--event` 不再支持
- `--fixture` 不再支持
- `--raw` 不再支持
- 数据源从 `learn/candidates/` 改为 `learn/reports/*.md`

如果你之前在脚本里这样用：

```bash
learning-loop-reporter notify --event ~/.openclaw/workspace/learn/events/reflection-completed.json
```

现在请改成：

```bash
learning-loop-reporter notify --date 2026-04-27
# 或
learning-loop-reporter notify --report ~/.openclaw/workspace/learn/reports/2026-04-27-daily.md
```

## 输出策略

飞书适配层会做这些事：
- 保留 markdown 标题层级
- 保留 emoji
- 跳过 `Run #N` 历史段
- 把候选库快照表格压成一句摘要
- 超过 30k 字符自动截断，并附完整报告路径

## 开发

```bash
npm test
npm run build
npm run verify
```

Fixtures：
- `fixtures/sample-daily-report.md`
- `fixtures/empty-day.md`
- `fixtures/with-stale.md`
- `fixtures/with-dropped.md`

## 不装 reporter 也能看

如果你只是想看日报，不需要发飞书，直接：

```bash
cat ~/.openclaw/workspace/learn/reports/2026-04-27-daily.md
```

这也是 v0.5.0 的核心定位：

> **reporter 是通道，不是数据源。**
