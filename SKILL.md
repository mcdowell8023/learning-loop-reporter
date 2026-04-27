# learning-loop-reporter

OpenClaw skill：自学习闭环日报推送。

当 `self-learning-loop reflect` 完成后自动触发，将反思结果推送到飞书。

## 安装

```bash
bash scripts/setup.sh
```

## 命令

- `learning-loop-reporter notify --event <path>` — 推送通知
- `learning-loop-reporter preview --event <path>` — 预览
- `learning-loop-reporter health` — 自检

## 依赖

- self-learning-loop ≥ 1.1.0-alpha.3
- openclaw CLI（用于飞书推送）
