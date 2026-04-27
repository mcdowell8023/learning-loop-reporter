# learning-loop-reporter

> 自学习闭环日报推送 — self-learning-loop 的 reporter skill

## 是什么

`learning-loop-reporter` 是 [self-learning-loop](https://github.com/mcdowell8023/self-learning-loop) 的配套 skill，负责在每日反思完成后，将结果摘要推送到飞书（或其他渠道）。

**v0.4.0 的重点不是版式，而是修正数据源假设。**

v0.3.0 把候选当成 `.json + confidence` 去读，面对真实的 `markdown + YAML frontmatter` 候选库会直接读空。v0.4.0 已改为按真实存储结构读取：

```text
~/.openclaw/workspace/learn/
├── candidates/
│   ├── 2026-04-25/*.md
│   └── 2026-04-26/*.md
├── candidates.db
├── events/
└── reporter-config.json
```

## 架构关系

```text
self-learning-loop reflect
    ↓ 写 events/reflection-completed.json
    ↓ 触发钩子：检查 reporter skill 是否存在
        ├─ 在 → 调用 learning-loop-reporter notify
        └─ 不在 → 静默跳过（不影响 reflect 主流程）
```

## 安装

```bash
git clone https://github.com/mcdowell8023/learning-loop-reporter.git
cd learning-loop-reporter
npm install
bash scripts/setup.sh
```

安装后：
- `~/.openclaw/workspace/skills/learning-loop-reporter/SKILL.md` — Skill 定义
- `~/.local/bin/learning-loop-reporter` — CLI 命令
- `~/.openclaw/workspace/learn/reporter-config.json` — 推送配置

## 配置

编辑 `~/.openclaw/workspace/learn/reporter-config.json`：

```json
{
  "channels": [
    { "type": "feishu", "target": "ou_你的open_id" }
  ],
  "stale_days": 4
}
```

- `channels`：消息投递目标
- `stale_days`：多少天以上算“超期未审”，默认 4

## 使用

```bash
# 推送通知（通常由 self-learning-loop 自动调用）
learning-loop-reporter notify --event ~/.openclaw/workspace/learn/events/reflection-completed.json

# 预览不发送
learning-loop-reporter preview --event <path>

# 用内置 fixture 开发自测
learning-loop-reporter preview --fixture rich-real
learning-loop-reporter preview --fixture empty
learning-loop-reporter preview --fixture errors-only
learning-loop-reporter preview --fixture compatibility-old
learning-loop-reporter preview --fixture rich-real --raw

# 自检
learning-loop-reporter health
```

## v0.4.0 输出示例

```text
📚 学习闭环日报｜2026-04-27

═══ 总览 ═══
1 events · 0 新候选 · 0 被丢弃 · 耗时 3.5s

═══ 🆕 今日新增候选 ═══
今日没有新增候选。

═══ ⚠️ 被丢弃 (0) ═══
今日没有被丢弃的候选。

═══ 📊 候选库总览 (共 6) ═══
pending 6 · reviewing 0 · shadow 0 · graduated 0

═══ ⏰ 超期未审 (≥4 天) ═══
当前没有超期未审候选。

═══ 🎯 现在该做什么 ═══
1. 处理超期未审：openclaw-learn review list --status pending
2. 详情：openclaw-learn review show <ID>

🤖 by learning-loop-reporter v0.4.0
```

## Breaking Changes（从 v0.3.0 升级要知道）

1. **不再读取/显示 `confidence`**
2. **标题改为基于 `problem_category`**
3. **backlog 从“高 confidence”改为“超期未审”**
4. **触发摘要来自 markdown 正文 `## Trigger Conditions`**

## 开发

```bash
npm install
npm test
npm run build

# 开发期默认走 stdout，不真发飞书
learning-loop-reporter preview --fixture rich-real
learning-loop-reporter preview --fixture empty
learning-loop-reporter preview --fixture errors-only
learning-loop-reporter preview --fixture compatibility-old
```

## 卸载

```bash
rm -rf ~/.openclaw/workspace/skills/learning-loop-reporter
rm ~/.local/bin/learning-loop-reporter
# 保留配置：~/.openclaw/workspace/learn/reporter-config.json
```
