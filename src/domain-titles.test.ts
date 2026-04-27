import { describe, expect, it } from 'vitest';
import { DOMAIN_TITLE_MAP, humanizeProblemCategory, shortId, titleForCandidate } from './domain-titles.js';

describe('domain-titles', () => {
  it('maps known domain to chinese title', () => {
    expect(DOMAIN_TITLE_MAP.model_routing_failure).toBe('模型路由故障识别');
    expect(titleForCandidate({ id: 'sha256:abc', problem_category: 'model_routing_failure' })).toBe('模型路由故障识别');
  });

  it('supports expanded domain map entries', () => {
    expect(titleForCandidate({ id: 'sha256:abc', problem_category: 'test_result_trust_and_environment_isolation' })).toBe('测试结果可信度与环境隔离');
    expect(titleForCandidate({ id: 'sha256:abc', problem_category: 'credential_token_path_mismatch' })).toBe('凭证路径不一致');
  });

  it('humanizes unknown domain', () => {
    expect(titleForCandidate({ id: 'sha256:abc', problem_category: 'future_new_problem' })).toBe('Future New Problem');
  });

  it('falls back to candidate short id when category is empty', () => {
    expect(titleForCandidate({ id: 'sha256:68b21d20a87ab861', problem_category: '' })).toBe('候选 68b21d20');
  });

  it('humanizeProblemCategory converts snake case', () => {
    expect(humanizeProblemCategory('release_quality_assurance')).toBe('Release Quality Assurance');
  });

  it('shortId strips sha256 prefix', () => {
    expect(shortId('sha256:68b21d20a87ab861')).toBe('68b21d20');
  });

  it('shortId handles plain ids', () => {
    expect(shortId('plain-id-123456')).toBe('plain-id');
  });
});
