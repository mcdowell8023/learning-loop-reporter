// src/render.test.ts — Tests for v0.2.0 render engine

import { describe, it, expect } from 'vitest';
import {
  assembleRenderData,
  renderFromData,
  computeAgeLabel,
  type ReflectionEvent,
  type CandidateInfo,
  type AssembleOptions,
} from './render.js';

function makeEvent(overrides: Record<string, any> = {}): ReflectionEvent {
  return {
    event: 'reflection-completed',
    version: '1.1',
    timestamp: '2026-04-27T06:00:00.000Z',
    runtime: 'openclaw',
    workspace: '/home/test/.openclaw/workspace',
    reflection: {
      from: null,
      to: null,
      watermark_before: '2026-04-26',
      watermark_after: '2026-04-27',
      duration_ms: 5200,
      events_collected: 15,
      candidates_generated: 2,
      candidates_dropped: 3,
      dropped_summary: { duplicate: 2, low_confidence: 1 },
      dropped_items: [
        { attempted_id: 'sha256:aaa', reason: 'duplicate', reason_detail: '与 xxx 重合', summary: '工具链报告测试通过但未验证' },
        { attempted_id: 'sha256:bbb', reason: 'duplicate', reason_detail: '与 yyy 重合', summary: '模型超时处理策略重复' },
        { attempted_id: null, reason: 'low_confidence', reason_detail: 'conf 0.15', summary: '日志格式建议' },
      ],
      reasons_triggered: ['manual'],
      new_candidate_ids: ['sha256:candidate_1', 'sha256:candidate_2'],
      ...overrides.reflection,
    },
    candidates_summary: {
      pending: 5,
      reviewing: 1,
      shadow: 2,
      graduated: 3,
      high_confidence: [],
      ...overrides.candidates_summary,
    },
    errors: overrides.errors ?? [],
  };
}

function makeCandidateLoader(candidates: Record<string, Partial<CandidateInfo>>) {
  return (id: string): CandidateInfo | null => {
    const c = candidates[id];
    if (!c) return null;
    return {
      id: c.id ?? id.slice(0, 18) + '…',
      domain: c.domain ?? 'test_domain',
      confidence: c.confidence ?? 0.8,
      status: c.status ?? 'pending',
      summary: c.summary ?? '测试候选摘要',
      trigger_event_summary: c.trigger_event_summary,
      created_at: c.created_at ?? '2026-04-27T00:00:00.000Z',
    };
  };
}

function assemble(event: ReflectionEvent, extra: Partial<AssembleOptions> = {}): ReturnType<typeof assembleRenderData> {
  return assembleRenderData({
    event,
    candidateLoader: extra.candidateLoader ?? makeCandidateLoader({
      'sha256:candidate_1': { summary: '架构类任务禁用 gemini', trigger_event_summary: '图灵超时退出', confidence: 0.85, domain: 'model_routing' },
      'sha256:candidate_2': { summary: '修订交付必须附自查证据', confidence: 0.6, domain: 'review_process' },
    }),
    backlogLoader: extra.backlogLoader ?? (() => []),
    now: extra.now ?? new Date('2026-04-27T14:00:00+08:00'),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('assembleRenderData + renderFromData', () => {
  it('1. full fields — all sections present', () => {
    const data = assemble(makeEvent());
    const output = renderFromData(data);

    expect(output).toContain('📚 自学习闭环日报 2026-04-27');
    expect(output).toContain('采集 events: 15');
    expect(output).toContain('新增 2');
    expect(output).toContain('dropped 3');
    expect(output).toContain('🆕 今日新增候选 (2)');
    expect(output).toContain('架构类任务禁用 gemini');
    expect(output).toContain('💭 触发：图灵超时退出');
    expect(output).toContain('⚠️ 今日 dropped 候选 (3)');
    expect(output).toContain('duplicate × 2');
    expect(output).toContain('low_confidence × 1');
    expect(output).toContain('工具链报告测试通过但未验证');
    expect(output).toContain('📈 累计候选状态');
    expect(output).toContain('pending: 5');
    expect(output).toContain('v0.2.0');
  });

  it('2. candidate without summary (compatibility)', () => {
    const data = assemble(makeEvent(), {
      candidateLoader: makeCandidateLoader({
        'sha256:candidate_1': { summary: '(no summary - candidate from older version)' },
        'sha256:candidate_2': { summary: '(no summary - candidate from older version)' },
      }),
    });
    const output = renderFromData(data);
    expect(output).toContain('(no summary - candidate from older version)');
  });

  it('3. event without dropped_summary — no dropped section', () => {
    const event = makeEvent({ reflection: { dropped_summary: undefined, dropped_items: undefined, candidates_dropped: 0, new_candidate_ids: ['sha256:candidate_1'] } });
    const data = assemble(event);
    const output = renderFromData(data);
    expect(output).not.toContain('⚠️ 今日 dropped');
  });

  it('4. dropped_items only 1 item', () => {
    const event = makeEvent({
      reflection: {
        dropped_summary: { other: 1 },
        dropped_items: [{ attempted_id: null, reason: 'other', summary: '单条测试' }],
        candidates_dropped: 1,
      },
    });
    const data = assemble(event);
    expect(data.dropped_items_top3).toHaveLength(1);
    const output = renderFromData(data);
    expect(output).toContain('[other] 单条测试');
  });

  it('5. dropped_items 5 items — only top 3 shown', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      attempted_id: `id_${i}`,
      reason: i < 2 ? 'duplicate' : 'low_confidence',
      summary: `item ${i} summary`,
    }));
    const event = makeEvent({
      reflection: {
        dropped_summary: { duplicate: 2, low_confidence: 3 },
        dropped_items: items,
        candidates_dropped: 5,
      },
    });
    const data = assemble(event);
    expect(data.dropped_items_top3).toHaveLength(3);
    // Should have diversity: at least one duplicate and one low_confidence
    const reasons = data.dropped_items_top3.map(d => d.reason);
    expect(reasons).toContain('duplicate');
    expect(reasons).toContain('low_confidence');
  });

  it('6. high_conf_backlog empty — no fire section', () => {
    const data = assemble(makeEvent(), { backlogLoader: () => [] });
    const output = renderFromData(data);
    expect(output).not.toContain('🔥');
  });

  it('7. high_conf_backlog with items', () => {
    const data = assemble(makeEvent(), {
      backlogLoader: () => [
        { id: 'sha256:old1', domain: 'test', confidence: 0.85, status: 'pending', summary: 'old', created_at: '2026-04-20T00:00:00Z' },
        { id: 'sha256:new1', domain: 'test', confidence: 0.75, status: 'pending', summary: 'new', created_at: '2026-04-27T00:00:00Z' },
        { id: 'sha256:low1', domain: 'test', confidence: 0.5, status: 'pending', summary: 'low conf', created_at: '2026-04-20T00:00:00Z' },
      ],
    });
    const output = renderFromData(data);
    expect(output).toContain('🔥');
    expect(output).toContain('⚠️ 7 天未审');
    expect(output).toContain('今日新增');
    // low conf should NOT be in backlog
    expect(data.high_conf_backlog).toHaveLength(2);
  });

  it('8. errors present', () => {
    const event = makeEvent({ errors: ['LLM timeout after 30s', 'Parse error'] });
    const data = assemble(event);
    const output = renderFromData(data);
    expect(output).toContain('❗ 本次有错误');
    expect(output).toContain('LLM timeout after 30s');
    expect(output).toContain('Parse error');
  });

  it('9. no new_candidate_ids — no 🆕 section', () => {
    const event = makeEvent({ reflection: { new_candidate_ids: undefined, candidates_generated: 0 } });
    const data = assemble(event);
    const output = renderFromData(data);
    expect(output).not.toContain('🆕');
  });

  it('10. missing fields do not crash', () => {
    const minimalEvent: ReflectionEvent = {
      event: 'reflection-completed',
      version: '1.0',
      timestamp: '2026-04-27T00:00:00Z',
      runtime: 'openclaw',
      workspace: '/test',
      reflection: {
        from: null, to: null,
        watermark_before: null, watermark_after: null,
        duration_ms: 100,
        events_collected: 0,
        candidates_generated: 0,
        candidates_dropped: 0,
        reasons_triggered: [],
      },
      candidates_summary: { pending: 0, reviewing: 0, shadow: 0, graduated: 0, high_confidence: [] },
      errors: [],
    };
    const data = assembleRenderData({ event: minimalEvent, candidateLoader: () => null, backlogLoader: () => [] });
    const output = renderFromData(data);
    expect(output).toContain('📚 自学习闭环日报');
    expect(output).toContain('v0.2.0');
  });
});

describe('computeAgeLabel', () => {
  const now = new Date('2026-04-27T14:00:00+08:00');

  it('today → 今日新增', () => {
    expect(computeAgeLabel('2026-04-27T10:00:00+08:00', now)).toBe('今日新增');
  });

  it('2 days → N 天未审', () => {
    expect(computeAgeLabel('2026-04-25T10:00:00+08:00', now)).toBe('2 天未审');
  });

  it('5 days → ⚠️ N 天未审', () => {
    expect(computeAgeLabel('2026-04-22T10:00:00+08:00', now)).toBe('⚠️ 5 天未审');
  });
});
