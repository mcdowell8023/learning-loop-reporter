import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDailyReport, loadDailyReportFromPath, loadLatestDailyReport } from './daily-report-loader.js';

function createWorkspace(): string {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'reporter-workspace-'));
  mkdirSync(join(workspaceDir, 'learn', 'reports'), { recursive: true });
  return workspaceDir;
}

function writeReport(workspaceDir: string, name: string, content: string): string {
  const filepath = join(workspaceDir, 'learn', 'reports', name);
  writeFileSync(filepath, content);
  return filepath;
}

describe('daily-report-loader', () => {
  it('loads report by date', () => {
    const workspaceDir = createWorkspace();
    writeReport(workspaceDir, '2026-04-27-daily.md', '---\ndate: 2026-04-27\nreflect_count: 3\n---\n\n# 标题');
    const report = loadDailyReport(workspaceDir, '2026-04-27');
    expect(report?.meta.date).toBe('2026-04-27');
  });

  it('returns null when dated report is missing', () => {
    const workspaceDir = createWorkspace();
    expect(loadDailyReport(workspaceDir, '2026-04-27')).toBeNull();
  });

  it('loads report from arbitrary path', () => {
    const workspaceDir = createWorkspace();
    const filepath = writeReport(workspaceDir, '2026-04-27-daily.md', '---\ndate: 2026-04-27\nreflect_count: 1\n---\n\n# 标题');
    const report = loadDailyReportFromPath(filepath);
    expect(report?.filepath).toBe(resolve(filepath));
  });

  it('returns null for missing arbitrary path', () => {
    expect(loadDailyReportFromPath('/tmp/does-not-exist.md')).toBeNull();
  });

  it('loads latest report by lexicographic date', () => {
    const workspaceDir = createWorkspace();
    writeReport(workspaceDir, '2026-04-26-daily.md', '---\ndate: 2026-04-26\nreflect_count: 1\n---\n\n# 旧');
    writeReport(workspaceDir, '2026-04-27-daily.md', '---\ndate: 2026-04-27\nreflect_count: 2\n---\n\n# 新');
    const report = loadLatestDailyReport(workspaceDir);
    expect(report?.meta.date).toBe('2026-04-27');
  });

  it('ignores non daily markdown files', () => {
    const workspaceDir = createWorkspace();
    writeReport(workspaceDir, 'notes.md', '# nope');
    expect(loadLatestDailyReport(workspaceDir)).toBeNull();
  });

  it('normalizes candidates_by_state object', () => {
    const workspaceDir = createWorkspace();
    writeReport(workspaceDir, '2026-04-27-daily.md', '---\ndate: 2026-04-27\ncandidates_by_state:\n  pending: 4\n  reviewing: 2\n---\n\n# 标题');
    const report = loadDailyReport(workspaceDir, '2026-04-27');
    expect(report?.meta.candidates_by_state).toEqual({ pending: 4, reviewing: 2 });
  });

  it('falls back to filename date when frontmatter date missing', () => {
    const workspaceDir = createWorkspace();
    writeReport(workspaceDir, '2026-04-27-daily.md', '---\nreflect_count: 3\n---\n\n# 标题');
    const report = loadDailyReport(workspaceDir, '2026-04-27');
    expect(report?.meta.date).toBe('2026-04-27');
  });
});
