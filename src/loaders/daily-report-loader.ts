import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import matter from 'gray-matter';

export interface DailyReportMeta {
  date: string;
  reflect_count: number;
  total_candidates: number;
  candidates_by_state: Record<string, number>;
  new_candidates_today: number;
  stale_backlog: number;
  generated_at: string;
}

export interface DailyReport {
  meta: DailyReportMeta;
  body: string;
  filepath: string;
}

function normalizeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeStateCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, count]) => [key, normalizeNumber(count)]),
  );
}

function normalizeMeta(data: Record<string, unknown>, fallbackDate: string): DailyReportMeta {
  return {
    date: typeof data.date === 'string' && data.date ? data.date : fallbackDate,
    reflect_count: normalizeNumber(data.reflect_count),
    total_candidates: normalizeNumber(data.total_candidates),
    candidates_by_state: normalizeStateCounts(data.candidates_by_state),
    new_candidates_today: normalizeNumber(data.new_candidates_today),
    stale_backlog: normalizeNumber(data.stale_backlog),
    generated_at: typeof data.generated_at === 'string' ? data.generated_at : '',
  };
}

function parseDailyReport(filepath: string): DailyReport {
  const raw = readFileSync(filepath, 'utf8');
  const parsed = matter(raw);
  const filename = basename(filepath);
  const fallbackDate = filename.match(/^(\d{4}-\d{2}-\d{2})-daily\.md$/)?.[1] ?? '';

  return {
    meta: normalizeMeta(parsed.data as Record<string, unknown>, fallbackDate),
    body: parsed.content.trim(),
    filepath,
  };
}

export function loadDailyReport(workspaceDir: string, date: string): DailyReport | null {
  const filepath = join(workspaceDir, 'learn', 'reports', `${date}-daily.md`);
  if (!existsSync(filepath)) return null;
  return parseDailyReport(filepath);
}

export function loadDailyReportFromPath(reportPath: string): DailyReport | null {
  const filepath = resolve(reportPath);
  if (!existsSync(filepath)) return null;
  return parseDailyReport(filepath);
}

export function loadLatestDailyReport(workspaceDir: string): DailyReport | null {
  const reportsDir = join(workspaceDir, 'learn', 'reports');
  if (!existsSync(reportsDir)) return null;

  const latest = readdirSync(reportsDir)
    .filter(name => /^\d{4}-\d{2}-\d{2}-daily\.md$/.test(name))
    .sort()
    .at(-1);

  if (!latest) return null;
  return parseDailyReport(join(reportsDir, latest));
}
