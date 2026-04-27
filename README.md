# learning-loop-reporter

> 自学习闭环日报推送 — self-learning-loop 的 reporter skill

## 是什么

`learning-loop-reporter` 是 [self-learning-loop](https://github.com/mcdowell8023/self-learning-loop) 的配套 skill，负责在每日反思完成后，将结果摘要推送到飞书（或其他渠道）。

## 架构关系

```
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

# 自检
learning-loop-reporter health
```

## 卸载

```bash
rm -rf ~/.openclaw/workspace/skills/learning-loop-reporter
rm ~/.local/bin/learning-loop-reporter
# 保留配置：~/.openclaw/workspace/learn/reporter-config.json
```

## 开发

```bash
npm install
npm test          # 运行测试
npm run build     # 编译 TypeScript
```
