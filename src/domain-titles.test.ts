import { describe, expect, it } from 'vitest';
import { DOMAIN_TITLE_MAP, shortId, titleForCandidate } from './domain-titles.js';

describe('domain-titles', () => {
  it('maps known domain to chinese title', () => {
    expect(DOMAIN_TITLE_MAP.model_routing_failure).toBe('模型路由故障识别');
    expect(titleForCandidate({ id: 'sha256:abc', domain: 'model_routing_failure' })).toBe('模型路由故障识别');
  });

  it('prefers summary over domain', () => {
    expect(titleForCandidate({ id: 'sha256:abc', domain: 'unknown', summary: '显超反馈可读性还是差' })).toBe('显超反馈可读性还是差');
  });

  it('truncates long summary at 30 chars', () => {
    const input = '这是一个超过三十个字的候选标题用于验证截断逻辑是否正常工作并且需要补充更多说明';
    expect(titleForCandidate({ id: 'sha256:abc', summary: input })).toBe(`${input.slice(0, 30)}…`);
  });

  it('ignores placeholder no summary', () => {
    expect(titleForCandidate({ id: 'sha256:abc', domain: 'unknown', summary: '(no summary)' })).toBe('未分类候选');
  });

  it('ignores legacy no summary text', () => {
    expect(titleForCandidate({ id: 'sha256:abc', domain: 'documentation_sync_failure', summary: '(no summary - candidate from older version)' })).toBe('文档同步失败');
  });

  it('falls back to raw domain when domain is unknown', () => {
    expect(titleForCandidate({ id: 'sha256:abc', domain: 'credential_token_path_mismatch' })).toBe('credential_token_path_mismatch');
  });

  it('falls back to candidate short id when neither summary nor domain exists', () => {
    expect(titleForCandidate({ id: 'sha256:68b21d20a87ab861' })).toBe('候选 68b21d20');
  });

  it('shortId strips sha256 prefix', () => {
    expect(shortId('sha256:68b21d20a87ab861')).toBe('68b21d20');
  });

  it('shortId handles plain ids', () => {
    expect(shortId('plain-id-123456')).toBe('plain-id');
  });
});
