// tests/render.test.ts

import { describe, it, expect } from 'vitest';
import { renderTemplate, loadDefaultTemplate, type ReflectionEvent } from '../src/render.js';

const template = `📚 自学习闭环日报 {{ date }}

📊 反思摘要
- 采集 events: {{ reflection.events_collected }}
- 新增候选: {{ reflection.candidates_generated }}（dropped {{ reflection.candidates_dropped }}）
- watermark: {{ reflection.watermark_before }} → {{ reflection.watermark_after }}
- 耗时: {{ duration_seconds }}s

📈 候选状态总览
- pending: {{ candidates_summary.pending }}
- reviewing: {{ candidates_summary.reviewing }}
- shadow: {{ candidates_summary.shadow }}
- graduated: {{ candidates_summary.graduated }}

🎓 高 confidence 候选（≥ 0.7）
{{#high_confidence}}
- {{ id }} | {{ domain }} | conf {{ confidence }}
{{/high_confidence}}
{{^high_confidence}}
- 暂无（candidates 都在 < 0.7）
{{/high_confidence}}

{{#errors_present}}
⚠️ 错误
{{#errors}}
- {{ . }}
{{/errors}}
{{/errors_present}}

📁 详情命令
- 查看候选: openclaw-learn review list
- 候选详情: openclaw-learn review show <id>
- 整体状态: openclaw-learn status`;

function makeEvent(overrides: Partial<ReflectionEvent> = {}): ReflectionEvent {
  return {
    event: 'reflection-completed',
    version: '1.0',
    timestamp: '2026-04-27T07:00:00Z',
    runtime: 'openclaw',
    workspace: '/tmp/test',
    reflection: {
      from: '2026-04-27',
      to: '2026-04-27',
      watermark_before: '2026-04-26',
      watermark_after: '2026-04-27',
      duration_ms: 3000,
      events_collected: 5,
      candidates_generated: 2,
      candidates_dropped: 0,
      reasons_triggered: ['manual'],
    },
    candidates_summary: {
      pending: 3,
      reviewing: 1,
      shadow: 2,
      graduated: 1,
      high_confidence: [],
    },
    errors: [],
    ...overrides,
  };
}

describe('renderTemplate', () => {
  it('renders basic fields correctly', () => {
    const result = renderTemplate(template, makeEvent());
    expect(result).toContain('📚 自学习闭环日报');
    expect(result).toContain('采集 events: 5');
    expect(result).toContain('pending: 3');
  });

  it('renders high_confidence candidates', () => {
    const result = renderTemplate(template, makeEvent({
      candidates_summary: {
        pending: 1, reviewing: 0, shadow: 0, graduated: 0,
        high_confidence: [{ id: 'cand-1', domain: 'ts', confidence: 0.92 }],
      },
    }));
    expect(result).toContain('cand-1 | ts | conf 0.92');
    expect(result).not.toContain('暂无');
  });

  it('shows fallback when no high confidence', () => {
    const result = renderTemplate(template, makeEvent());
    expect(result).toContain('暂无');
  });

  it('renders errors when present', () => {
    const result = renderTemplate(template, makeEvent({ errors: ['timeout on session 3'] }));
    expect(result).toContain('timeout on session 3');
  });

  it('hides error block when no errors', () => {
    const result = renderTemplate(template, makeEvent({ errors: [] }));
    expect(result).not.toContain('⚠️ 错误');
  });

  it('handles undefined errors gracefully', () => {
    const event = makeEvent();
    delete (event as any).errors;
    const result = renderTemplate(template, event);
    expect(result).not.toContain('⚠️ 错误');
  });
});
