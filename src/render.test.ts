import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assembleReportData, firstSentence, isSameDay, renderFromData, type ReflectionEvent } from './render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name: string) => JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', `${name}.json`), 'utf8')) as ReflectionEvent;
const emptyFixture = loadFixture('empty');
const richRealFixture = loadFixture('rich-real');
const errorsOnlyFixture = loadFixture('errors-only');
const compatibilityOldFixture = loadFixture('compatibility-old');

function loadRealCandidates() {
  const workspaceDir = '/home/mcdowell/.openclaw/workspace';
  return assembleReportData({
    event: richRealFixture,
    workspaceDir,
    now: new Date('2026-04-27T14:00:00+08:00'),
  });
}

describe('helpers', () => {
  it('compute first sentence with truncation', () => {
    expect(firstSentence('这是一段很长很长的话，用来验证首句截断是否会在超过六十个字符时追加省略号而不是原样输出。后面还有第二句。', 20)).toBe('这是一段很长很长的话，用来验证首句截断是…');
  });

  it('isSameDay matches by date prefix', () => {
    expect(isSameDay('2026-04-27T10:00:00.000Z', '2026-04-27')).toBe(true);
    expect(isSameDay('2026-04-26T23:59:59.000Z', '2026-04-27')).toBe(false);
  });
});

describe('assembleReportData', () => {
  it('assembles real candidate corpus', () => {
    const data = loadRealCandidates();
    expect(data.total_candidates).toBe(6);
    expect(data.candidates_by_state.pending).toBe(6);
    expect(data.new_candidates).toHaveLength(0);
    expect(data.stale_backlog).toHaveLength(0);
  });

  it('finds same-day candidates as new candidates', () => {
    const event = loadFixture('rich');
    const data = assembleReportData({ event, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-26T23:30:00.000Z') });
    expect(data.new_candidates.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty fixture', () => {
    const data = assembleReportData({ event: emptyFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') });
    expect(data.reflection.candidates_generated).toBe(0);
    expect(data.errors).toHaveLength(0);
  });

  it('handles errors-only fixture', () => {
    const data = assembleReportData({ event: errorsOnlyFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') });
    expect(data.errors).toHaveLength(2);
    expect(data.reflection.candidates_generated).toBe(0);
  });

  it('handles compatibility-old fixture with real store counts', () => {
    const data = assembleReportData({ event: compatibilityOldFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') });
    expect(data.total_candidates).toBe(6);
    expect(data.candidates_by_state.pending).toBe(6);
  });
});

describe('renderFromData snapshots', () => {
  it('renders rich-real fixture', () => {
    expect(renderFromData(loadRealCandidates())).toMatchSnapshot();
  });

  it('renders empty fixture', () => {
    expect(renderFromData(assembleReportData({ event: emptyFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') }))).toMatchSnapshot();
  });

  it('renders errors-only fixture', () => {
    expect(renderFromData(assembleReportData({ event: errorsOnlyFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') }))).toMatchSnapshot();
  });

  it('renders compatibility-old fixture', () => {
    expect(renderFromData(assembleReportData({ event: compatibilityOldFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') }))).toMatchSnapshot();
  });

  it('includes stale backlog section title', () => {
    const output = renderFromData(loadRealCandidates());
    expect(output).toContain('═══ ⏰ 超期未审 (≥4 天) ═══');
  });

  it('always includes details action', () => {
    const output = renderFromData(assembleReportData({ event: emptyFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') }));
    expect(output).toContain('详情：openclaw-learn review show <ID>');
  });

  it('shows error section only when errors exist', () => {
    expect(renderFromData(assembleReportData({ event: errorsOnlyFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') }))).toContain('═══ ❗ 错误 ═══');
    expect(renderFromData(assembleReportData({ event: emptyFixture, workspaceDir: '/home/mcdowell/.openclaw/workspace', now: new Date('2026-04-27T14:00:00+08:00') }))).not.toContain('═══ ❗ 错误 ═══');
  });
});
