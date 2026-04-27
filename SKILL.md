# learning-loop-reporter

OpenClaw skill：把 `self-learning-loop` 生成的 daily report markdown 转成飞书文本并发送。

## 安装

```bash
bash scripts/setup.sh
```

## 命令

- `learning-loop-reporter preview [--date YYYY-MM-DD] [--report <path>]` — 预览飞书文本
- `learning-loop-reporter notify [--date YYYY-MM-DD] [--report <path>]` — 发送飞书消息
- `learning-loop-reporter health` — 自检（配置 + latest report）

## 依赖

- self-learning-loop ≥ 1.1.0-alpha.5
- openclaw CLI（用于飞书推送）
