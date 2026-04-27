# RELEASE NOTES — v0.3.0

发布日期：2026-04-27

## 这次改了什么

v0.3.0 的目标只有一个：**让日报在飞书窄屏里更好读**。

核心变化：
- 候选标题从 hash 改成人话标题（summary → 中文 domain → fallback 短 ID）
- 新候选改成 3~4 行紧凑卡片
- dropped 段改成单层 emoji 分组
- 详情命令从每条候选里移走，统一收口到「现在该做什么」
- preview 支持 `--fixture` 和 `--raw`
- 完全程序化渲染，移除模板文件依赖

## v0.2.0 → v0.3.0 视觉对比

### v0.2.0

```text
【1】sha256:68b21d20a87…
  conf: 0.5 | domain: model_routing_failure | status: pending
  📝 (no summary)
  💭 触发：2026-04-26 pollinations API 故障诊断
  ➜ openclaw-learn review show sha256:68b21d20a87…
```

### v0.3.0

```text
▸ 模型路由故障识别 [pending · conf 0.5]
   触发：2026-04-26 pollinations API 故障诊断
   说明：(no summary)
   ID: 68b21d20
```

## 验收关注点

- 飞书消息预算：开发期间 0 条真发，最终验收 1 条真发
- fixture 预览：`rich / empty / errors-only / compatibility-old`
- 兼容旧候选：无 `summary` 字段时仍能读
- 行动区固定保留详情命令：`openclaw-learn review show <ID>`
