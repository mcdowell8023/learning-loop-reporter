import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { aggregateByState, daysBetween, extractSection, findStaleBacklog, loadAllCandidates, shortId } from './candidate-loader.js';

function createWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'candidate-loader-'));
}

function writeCandidate(workspaceDir: string, dateDir: string, fileName: string, content: string): string {
  const dir = join(workspaceDir, 'learn', 'candidates', dateDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileName);
  writeFileSync(path, content);
  return path;
}

const fullCandidate = `---
id: sha256:68b21d20a87ab861e13306048defad3d4e15206bad2b3bdaf7b43e4cb583709d
problem_category: model_routing_failure
scope: tool:pollinations__chatCompletion
state: pending
created_at: 2026-04-26T22:00:41.248Z
updated_at: 2026-04-26T22:00:41.248Z
tags:
  - model-routing
  - schema-validation
instance_count: 1
source_session: cli-reflect-2026-04-26T22:00:23.849Z
---

# model_routing_failure

## Trigger Conditions

使用 gpt-5.4 时出现启动即崩溃/400 报 schema invalid，且同一会话直接 PING-OK 但子代理 spawn 后注入工具导致失败。

## Recommended Action

先做隔离式工具注入验证。
`;

describe('candidate-loader', () => {
  it('parses a full markdown candidate', () => {
    const workspaceDir = createWorkspace();
    writeCandidate(workspaceDir, '2026-04-26', 'candidate.md', fullCandidate);
    const candidates = loadAllCandidates(workspaceDir, new Date('2026-04-27T22:00:41.248Z'));

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.problem_category).toBe('model_routing_failure');
    expect(candidates[0]?.short_id).toBe('68b21d20');
    expect(candidates[0]?.trigger_conditions).toContain('schema invalid');
    expect(candidates[0]?.recommended_action).toContain('隔离式工具注入验证');
    expect(candidates[0]?.age_days).toBe(1);
  });

  it('defaults missing optional fields', () => {
    const workspaceDir = createWorkspace();
    writeCandidate(workspaceDir, '2026-04-26', 'candidate.md', `---\nid: sha256:abc\ncreated_at: 2026-04-26T00:00:00.000Z\n---\n`);
    const candidates = loadAllCandidates(workspaceDir, new Date('2026-04-27T00:00:00.000Z'));

    expect(candidates[0]?.problem_category).toBe('unknown');
    expect(candidates[0]?.state).toBe('pending');
    expect(candidates[0]?.updated_at).toBe('2026-04-26T00:00:00.000Z');
  });

  it('extracts trigger and recommended action sections', () => {
    const markdown = '# title\n\n## Trigger Conditions\n\nfirst\n\n## Recommended Action\n\nsecond\n';
    expect(extractSection(markdown, 'Trigger Conditions')).toBe('first');
    expect(extractSection(markdown, 'Recommended Action')).toBe('second');
  });

  it('returns undefined for missing section', () => {
    expect(extractSection('# title', 'Trigger Conditions')).toBeUndefined();
  });

  it('skips non-date directories', () => {
    const workspaceDir = createWorkspace();
    writeCandidate(workspaceDir, 'drafts', 'candidate.md', fullCandidate);
    expect(loadAllCandidates(workspaceDir)).toHaveLength(0);
  });

  it('returns empty when candidates dir is missing', () => {
    expect(loadAllCandidates(createWorkspace())).toEqual([]);
  });

  it('does not crash on broken markdown file', () => {
    const workspaceDir = createWorkspace();
    writeCandidate(workspaceDir, '2026-04-26', 'broken.md', '---\nid: [bad yaml\n---');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(loadAllCandidates(workspaceDir)).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('computes day differences safely', () => {
    expect(daysBetween('2026-04-23T10:00:00+08:00', new Date('2026-04-27T18:00:00+08:00'))).toBe(4);
    expect(daysBetween('', new Date())).toBe(0);
    expect(daysBetween('invalid', new Date())).toBe(0);
  });

  it('aggregates by state', () => {
    const candidates = [
      { state: 'pending' },
      { state: 'pending' },
      { state: 'reviewing' },
      { state: 'shadow' },
      { state: 'graduated' },
    ] as never[];
    expect(aggregateByState(candidates)).toEqual({ pending: 2, reviewing: 1, shadow: 1, graduated: 1 });
  });

  it('finds stale backlog from pending candidates only', () => {
    const result = findStaleBacklog([
      { id: '1', state: 'pending', age_days: 5, created_at: '2026-04-20T00:00:00.000Z' },
      { id: '2', state: 'reviewing', age_days: 9, created_at: '2026-04-16T00:00:00.000Z' },
      { id: '3', state: 'pending', age_days: 4, created_at: '2026-04-21T00:00:00.000Z' },
    ] as never[], 4);
    expect(result.map(item => item.id)).toEqual(['1', '3']);
  });

  it('shortId strips sha256 prefix', () => {
    expect(shortId('sha256:68b21d20a87ab861')).toBe('68b21d20');
  });
});
