# learning-loop-reporter

> 自学习闭环日报推送 — self-learning-loop 的 reporter skill

## 是什么

`learning-loop-reporter` 是 [self-learning-loop](https://github.com/mcdowell8023/self-learning-loop) 的配套 skill，负责在每日反思完成后，将结果摘要推送到飞书（或其他渠道）。

v0.3.0 的重点不是“多发一点信息”，而是**把已有信息变得更好读**：人话标题、紧凑卡片、单层 dropped 分组、统一行动区。

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
  ]
}
```

## 使用

```bash
# 推送通知（通常由 self-learning-loop 自动调用）
learning-loop-reporter notify --event ~/.openclaw/workspace/learn/events/reflection-completed.json

# 预览不发送
learning-loop-reporter preview --event <path>

# 用内置 fixture 开发自测
learning-loop-reporter preview --fixture rich
learning-loop-reporter preview --fixture compatibility-old
learning-loop-reporter preview --fixture rich --raw

# 自检
learning-loop-reporter health
```

## v0.3.0 输出示例

```text
📚 学习闭环日报｜2026-04-27

═══ 总览 ═══
22 events · 2 新候选 · 3 被丢弃 · 耗时 5.2s

═══ 🆕 新候选 ═══

▸ 模型路由故障识别 [pending · conf 0.5]
   触发：2026-04-26 pollinations API 故障诊断
   说明：(no summary)
   ID: 68b21d20

▸ 未分类候选 [pending · conf 0.5]
   说明：(no summary)
   ID: f50ea43f

═══ ⚠️ 被丢弃 (3) ═══
🔁 重复 (2)
   • 工具链报告测试通过但实际未在生产环境验证
   • 发版前必须跑完整测试矩阵

📉 信号太弱 (1)
   • 日志格式优化建议

═══ 📊 累计 ═══
pending 6 · reviewing 0 · shadow 0 · graduated 0

═══ 🎯 现在该做什么 ═══
1. review 新候选（ID: 68b21d20 / f50ea43f）
2. 处理超期未审：openclaw-learn review list --status pending --min-conf 0.7
3. 详情：openclaw-learn review show <ID>

🤖 by learning-loop-reporter v0.3.0
```

## 开发

```bash
npm install
npm test
npm run build

# 开发期默认走 stdout，不真发飞书
learning-loop-reporter preview --fixture rich
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
