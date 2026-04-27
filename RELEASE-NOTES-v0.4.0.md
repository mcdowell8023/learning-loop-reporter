# learning-loop-reporter v0.4.0

发布日期：2026-04-27

## TL;DR

v0.4.0 修掉了 v0.3.0 的核心后端问题：reporter 之前按 `.json + confidence` 的旧假设读候选，面对真实的 `markdown + YAML frontmatter` 候选库时会直接读空。现在已切到真实存储结构，能正确读取 `~/.openclaw/workspace/learn/candidates/YYYY-MM-DD/*.md`。

## 这次修了什么

### 1) 候选加载器重写
- 新增 `src/loaders/candidate-loader.ts`
- 从真实目录遍历 markdown 候选
- 使用 `gray-matter` 解析 frontmatter
- 从正文抽取：
  - `## Trigger Conditions`
  - `## Recommended Action`
- 派生字段：`short_id` / `age_days` / `filepath`

### 2) 报表语义改了

**Breaking change：移除 confidence 视角，改为真实 schema 视角。**

旧版：
- 假设候选有 `confidence`
- “高 confidence backlog”
- 标题优先取 `summary`

新版：
- 真实 schema 没有 `confidence`
- backlog 改成“超期未审 backlog”
- 标题基于 `problem_category`
- 触发摘要来自正文 `## Trigger Conditions`
- 展示年龄改成 `N 天前`

### 3) 模板升级
- `🆕 新候选` → `🆕 今日新增候选`
- `📊 累计` → `📊 候选库总览 (共 N)`
- 新增 `⏰ 超期未审 (≥4 天)`
- 行动区不再依赖 `--min-conf`

### 4) domain 映射扩展
补齐真实候选库里的 domain/problem_category，包括：
- `test_result_trust_and_environment_isolation`
- `progressive_defer_to_next_day`
- `credential_token_path_mismatch`
- `release_quality_assurance`
等。

### 5) 测试升级
- 总计 **48 tests pass**
- 新增 candidate loader 测试 11 case
- snapshot 更新到 v0.4.0 新格式
- CLI / render / sections / send 全量回归通过

## Breaking Changes

1. **不再读取/展示 `confidence`**
2. **`titleForCandidate()` 改为基于 `problem_category`**
3. **backlog 含义改为“超期未审”而不是“高 confidence”**
4. **默认动作命令改为：**
   ```bash
   openclaw-learn review list --status pending
   ```

## 验证结果

```bash
npm test     # 48/48 pass
npm run build
learning-loop-reporter preview --event <latest reflection event>
```

## 升级建议

如果你之前已经安装过 v0.3.0：

```bash
cd learning-loop-reporter
npm install
npm run build
bash scripts/setup.sh
```

若希望调整“超期未审”阈值，可在 `~/.openclaw/workspace/learn/reporter-config.json` 中加：

```json
{
  "channels": [
    { "type": "feishu", "target": "ou_xxx" }
  ],
  "stale_days": 4
}
```
