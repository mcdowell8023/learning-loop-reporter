import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assembleRenderData, computeAgeDays, renderFromData, type CandidateInfo, type ReflectionEvent } from './render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name: string) => JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', `${name}.json`), 'utf8')) as ReflectionEvent;
const emptyFixture = loadFixture('empty');
const richFixture = loadFixture('rich');
const errorsOnlyFixture = loadFixture('errors-only');
const compatibilityOldFixture = loadFixture('compatibility-old');

function candidateLoader(id: string): CandidateInfo | null {
  const map: Record<string, CandidateInfo> = {
    'sha256:68b21d20a87ab861e13306048defad3d4e15206bad2b3bdaf7b43e4cb583709d': {
      id,
      domain: 'model_routing_failure',
      confidence: 0.5,
      status: 'pending',
      summary: '(no summary)',
      trigger_event_summary: '2026-04-26 pollinations API 故障诊断',
      created_at: '2026-04-26T22:00:41.248Z',
    },
    'sha256:f50ea43fc23971f1fa0af184cfe5e99217fbae80560ba795a8f018706cd947ce': {
      id,
      domain: 'unknown',
      confidence: 0.5,
      status: 'pending',
      summary: '(no summary)',
      created_at: '2026-04-26T22:00:41.260Z',
    },
    'sha256:11111111aaaaaaaa22222222bbbbbbbb33333333cccccccc44444444dddddddd': {
      id,
      domain: 'documentation_sync_failure',
      confidence: 0.7,
      status: 'pending',
      summary: '(no summary - candidate from older version)',
      created_at: '2026-04-25T10:00:00.000Z',
    },
  };
  return map[id] ?? null;
}

function backlogLoader(): CandidateInfo[] {
  return [
    {
      id: 'sha256:68b21d20a87ab861e13306048defad3d4e15206bad2b3bdaf7b43e4cb583709d',
      domain: 'model_routing_failure',
      confidence: 0.8,
      status: 'pending',
      summary: 'old enough',
      created_at: '2026-04-20T00:00:00.000Z',
    },
    {
      id: 'sha256:short0000bbbb',
      domain: 'unknown',
      confidence: 0.95,
      status: 'reviewing',
      summary: 'ignore reviewing',
      created_at: '2026-04-20T00:00:00.000Z',
    },
  ];
}

function assemble(event: ReflectionEvent) {
  return assembleRenderData({
    event,
    candidateLoader,
    backlogLoader,
    now: new Date('2026-04-27T14:00:00+08:00'),
  });
}

describe('computeAgeDays', () => {
  it('returns 0 for same day', () => {
    expect(computeAgeDays('2026-04-27T10:00:00+08:00', new Date('2026-04-27T18:00:00+08:00'))).toBe(0);
  });

  it('returns whole day difference', () => {
    expect(computeAgeDays('2026-04-23T10:00:00+08:00', new Date('2026-04-27T18:00:00+08:00'))).toBe(4);
  });
});

describe('assembleRenderData', () => {
  it('assembles rich fixture with titles and dropped groups', () => {
    const data = assemble(richFixture as ReflectionEvent);
    expect(data.newCandidates).toHaveLength(2);
    expect(data.newCandidates[0]?.title).toBe('模型路由故障识别');
    expect(data.newCandidates[1]?.title).toBe('未分类候选');
    expect(data.newCandidates[0]?.trigger).toContain('pollinations API 故障诊断');
    expect(data.newCandidates[0]?.note).toBe('(no summary)');
    expect(data.droppedGroups).toHaveLength(2);
    expect(data.backlog[0]?.ageDays).toBeGreaterThanOrEqual(4);
  });

  it('keeps note empty when summary is used as title', () => {
    const event = structuredClone(richFixture) as ReflectionEvent;
    const loader = () => ({
      id: 'sha256:68b21d20a87ab861e13306048defad3d4e15206bad2b3bdaf7b43e4cb583709d',
      domain: 'model_routing_failure',
      confidence: 0.5,
      status: 'pending',
      summary: '标题已经够说明问题了',
      created_at: '2026-04-26T22:00:41.248Z',
    });
    const data = assembleRenderData({ event, candidateLoader: loader, backlogLoader: () => [], now: new Date('2026-04-27T14:00:00+08:00') });
    expect(data.newCandidates[0]?.title).toBe('标题已经够说明问题了');
    expect(data.newCandidates[0]?.note).toBeUndefined();
  });

  it('falls back gracefully when candidate cannot be loaded', () => {
    const data = assembleRenderData({ event: richFixture as ReflectionEvent, candidateLoader: () => null, backlogLoader: () => [] });
    expect(data.newCandidates[0]?.title).toMatch(/候选|未分类候选/);
    expect(data.newCandidates[0]?.shortId).toBe('68b21d20');
  });

  it('handles errors-only fixture', () => {
    const data = assemble(errorsOnlyFixture as ReflectionEvent);
    expect(data.errors).toHaveLength(2);
    expect(data.candidatesGenerated).toBe(0);
  });

  it('handles compatibility-old fixture', () => {
    const data = assemble(compatibilityOldFixture as ReflectionEvent);
    expect(data.newCandidates[0]?.title).toBe('文档同步失败');
    expect(data.newCandidates[0]?.note).toBe('(no summary - candidate from older version)');
  });
});

describe('renderFromData snapshots', () => {
  it('renders rich fixture', () => {
    expect(renderFromData(assemble(richFixture as ReflectionEvent))).toMatchSnapshot();
  });

  it('renders empty fixture', () => {
    expect(renderFromData(assemble(emptyFixture as ReflectionEvent))).toMatchSnapshot();
  });

  it('renders errors-only fixture', () => {
    expect(renderFromData(assemble(errorsOnlyFixture as ReflectionEvent))).toMatchSnapshot();
  });

  it('renders compatibility-old fixture', () => {
    expect(renderFromData(assemble(compatibilityOldFixture as ReflectionEvent))).toMatchSnapshot();
  });

  it('includes overdue bulk review action when backlog exists', () => {
    const output = renderFromData(assemble(richFixture as ReflectionEvent));
    expect(output).toContain('处理超期未审：openclaw-learn review list --status pending --min-conf 0.7');
  });

  it('always includes details action', () => {
    const output = renderFromData(assemble(emptyFixture as ReflectionEvent));
    expect(output).toContain('详情：openclaw-learn review show <ID>');
  });

  it('shows error section only when errors exist', () => {
    expect(renderFromData(assemble(errorsOnlyFixture as ReflectionEvent))).toContain('═══ ❗ 错误 ═══');
    expect(renderFromData(assemble(emptyFixture as ReflectionEvent))).not.toContain('═══ ❗ 错误 ═══');
  });
});
