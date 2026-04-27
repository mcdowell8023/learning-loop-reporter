// tests/render.test.ts

import { describe, it, expect } from 'vitest';
import { renderTemplate, type ReflectionEvent } from '../src/render.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(resolve(__dirname, '..', 'templates', 'daily-report.tmpl'), 'utf-8');

function makeEvent(overrides: Partial<ReflectionEvent> = {}): ReflectionEvent {
  return {
    event: 'reflection-completed',
    version: '1.0',
    timestamp: '2026-04-27T07:00:00+08:00',
    runtime: 'openclaw',
    workspace: '/home/user/.openclaw/workspace',
    reflection: {
      from: '2026-04-26',
      to: '2026-04-26',
      watermark_before: '2026-04-25',
      watermark_after: '2026-04-26',
      duration_ms: 12340,
      events_collected: 22,
      candidates_generated: 3,
      candidates_dropped: 1,
      reasons_triggered: ['scheduled'],
    },
    candidates_summary: {
      pending: 6,
      reviewing: 0,
      shadow: 0,
      graduated: 0,
      high_confidence: [
        { id: 'doc_sync_failure', domain: 'general', confidence: 0.78 },
      ],
    },
    errors: [],
    ...overrides,
  };
}

describe('renderTemplate', () => {
  it('renders basic fields correctly', () => {
    const result = renderTemplate(template, makeEvent());
    expect(result).toContain('📚 自学习闭环日报 2026-04-27');
    expect(result).toContain('采集 events: 22');
    expect(result).toContain('新增候选: 3（dropped 1）');
    expect(result).toContain('watermark: 2026-04-25 → 2026-04-26');
    expect(result).toContain('耗时: 12.3s');
  });

  it('renders candidates summary', () => {
    const result = renderTemplate(template, makeEvent());
    expect(result).toContain('pending: 6');
    expect(result).toContain('reviewing: 0');
  });

  it('renders high_confidence candidates', () => {
    const result = renderTemplate(template, makeEvent());
    expect(result).toContain('doc_sync_failure | general | conf 0.78');
    expect(result).not.toContain('暂无');
  });

  it('renders empty high_confidence with fallback text', () => {
    const event = makeEvent({
      candidates_summary: { pending: 2, reviewing: 0, shadow: 0, graduated: 0, high_confidence: [] },
    });
    const result = renderTemplate(template, event);
    expect(result).toContain('暂无');
  });

  it('renders multiple high_confidence candidates', () => {
    const event = makeEvent({
      candidates_summary: {
        pending: 3, reviewing: 0, shadow: 0, graduated: 0,
        high_confidence: [
          { id: 'bug_a', domain: 'tool:git', confidence: 0.85 },
          { id: 'bug_b', domain: 'general', confidence: 0.72 },
        ],
      },
    });
    const result = renderTemplate(template, event);
    expect(result).toContain('bug_a | tool:git | conf 0.85');
    expect(result).toContain('bug_b | general | conf 0.72');
  });

  it('renders errors when present', () => {
    const event = makeEvent({ errors: ['LLM timeout', 'DB write failed'] });
    const result = renderTemplate(template, event);
    expect(result).toContain('⚠️ 本次有错误');
    expect(result).toContain('LLM timeout');
    expect(result).toContain('DB write failed');
  });

  it('hides error block when no errors', () => {
    const result = renderTemplate(template, makeEvent());
    expect(result).not.toContain('⚠️ 本次有错误');
  });

  it('always includes command reference', () => {
    const result = renderTemplate(template, makeEvent());
    expect(result).toContain('openclaw-learn review list');
    expect(result).toContain('openclaw-learn status');
  });

  it('handles zero duration', () => {
    const event = makeEvent();
    event.reflection.duration_ms = 0;
    const result = renderTemplate(template, event);
    expect(result).toContain('耗时: 0.0s');
  });
});
