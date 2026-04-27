export const DOMAIN_TITLE_MAP: Record<string, string> = {
  model_routing_failure: '模型路由故障识别',
  test_result_trust: '测试结果可信度',
  documentation_sync_failure: '文档同步失败',
  environment_isolation: '环境隔离要求',
  cli_compatibility: 'CLI 兼容性',
  feishu_message_overflow: '飞书消息过载',
  tool_chain_validation: '工具链验证',
  release_pipeline: '发版流程',
  release_quality_assurance: '发布质量保障',
  schema_compatibility: 'Schema 兼容性',
  context_management: '上下文管理',
  unknown: '未分类候选',
};

export function shortId(id: string): string {
  if (id.startsWith('sha256:')) return id.slice(7, 15);
  return id.slice(0, 8);
}

export function titleForCandidate(c: { id: string; summary?: string | null; domain?: string | null }): string {
  const summary = c.summary?.trim();
  if (summary && summary !== '(no summary)' && !summary.includes('no summary - candidate from older version')) {
    return summary.length > 30 ? `${summary.slice(0, 30)}…` : summary;
  }
  if (c.domain && DOMAIN_TITLE_MAP[c.domain]) return DOMAIN_TITLE_MAP[c.domain];
  if (c.domain) return c.domain;
  return `候选 ${shortId(c.id)}`;
}
