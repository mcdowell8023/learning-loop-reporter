import type { Candidate } from './loaders/candidate-loader.js';

export const DOMAIN_TITLE_MAP: Record<string, string> = {
  model_routing_failure: '模型路由故障识别',
  test_result_trust: '测试结果可信度',
  test_result_trust_and_environment_isolation: '测试结果可信度与环境隔离',
  documentation_sync_failure: '文档同步失败',
  environment_isolation: '环境隔离要求',
  cli_compatibility: 'CLI 兼容性',
  feishu_message_overflow: '飞书消息过载',
  tool_chain_validation: '工具链验证',
  release_pipeline: '发版流程',
  release_quality_assurance: '发版质量保障',
  schema_compatibility: 'Schema 兼容性',
  context_management: '上下文管理',
  progressive_defer_to_next_day: '渐进式推迟原则',
  credential_token_path_mismatch: '凭证路径不一致',
  unknown: '未分类候选',
};

export function shortId(id: string): string {
  if (id.startsWith('sha256:')) return id.slice(7, 15);
  return id.slice(0, 8);
}

export function humanizeProblemCategory(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function titleForCandidate(candidate: Pick<Candidate, 'id' | 'problem_category'>): string {
  if (DOMAIN_TITLE_MAP[candidate.problem_category]) return DOMAIN_TITLE_MAP[candidate.problem_category];
  if (candidate.problem_category) return humanizeProblemCategory(candidate.problem_category);
  return `候选 ${shortId(candidate.id)}`;
}
