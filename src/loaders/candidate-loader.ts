import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

export interface Candidate {
  id: string;
  short_id: string;
  problem_category: string;
  state: 'pending' | 'reviewing' | 'shadow' | 'graduated' | string;
  created_at: string;
  updated_at: string;
  scope?: string;
  tags?: string[];
  instance_count?: number;
  source_session?: string;
  trigger_conditions?: string;
  recommended_action?: string;
  body?: string;
  age_days: number;
  filepath: string;
}

export interface CandidateStateCounts {
  pending: number;
  reviewing: number;
  shadow: number;
  graduated: number;
}

export function loadAllCandidates(workspaceDir: string, now: Date = new Date()): Candidate[] {
  const candidatesDir = join(workspaceDir, 'learn', 'candidates');
  if (!existsSync(candidatesDir)) return [];

  const result: Candidate[] = [];

  for (const dateDir of readdirSync(candidatesDir)) {
    const dateDirPath = join(candidatesDir, dateDir);
    if (!statSync(dateDirPath).isDirectory()) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue;

    for (const file of readdirSync(dateDirPath)) {
      if (!file.endsWith('.md')) continue;
      const filepath = join(dateDirPath, file);

      try {
        const raw = readFileSync(filepath, 'utf-8');
        const parsed = matter(raw);
        const fm = parsed.data as Record<string, unknown>;
        const id = typeof fm.id === 'string' ? fm.id : undefined;
        if (!id) continue;
        const createdAt = normalizeIso(fm.created_at);
        const updatedAt = normalizeIso(fm.updated_at) || createdAt;

        result.push({
          id,
          short_id: shortId(id),
          problem_category: typeof fm.problem_category === 'string' ? fm.problem_category : 'unknown',
          state: typeof fm.state === 'string' ? fm.state : 'pending',
          created_at: createdAt,
          updated_at: updatedAt,
          scope: typeof fm.scope === 'string' ? fm.scope : undefined,
          tags: Array.isArray(fm.tags) ? fm.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
          instance_count: typeof fm.instance_count === 'number' ? fm.instance_count : undefined,
          source_session: typeof fm.source_session === 'string' ? fm.source_session : undefined,
          trigger_conditions: extractSection(parsed.content, 'Trigger Conditions'),
          recommended_action: extractSection(parsed.content, 'Recommended Action'),
          body: parsed.content,
          age_days: daysBetween(createdAt, now),
          filepath,
        });
      } catch (error) {
        console.error('[candidate-loader] failed to parse:', filepath, error);
      }
    }
  }

  return result;
}

export function aggregateByState(candidates: Candidate[]): CandidateStateCounts {
  return {
    pending: candidates.filter(candidate => candidate.state === 'pending').length,
    reviewing: candidates.filter(candidate => candidate.state === 'reviewing').length,
    shadow: candidates.filter(candidate => candidate.state === 'shadow').length,
    graduated: candidates.filter(candidate => candidate.state === 'graduated').length,
  };
}

export function findStaleBacklog(candidates: Candidate[], staleDays = 4): Candidate[] {
  return candidates
    .filter(candidate => candidate.state === 'pending' && candidate.age_days >= staleDays)
    .sort((a, b) => b.age_days - a.age_days || a.created_at.localeCompare(b.created_at));
}

export function shortId(id: string): string {
  if (id.startsWith('sha256:')) return id.slice(7, 15);
  return id.slice(0, 8);
}

export function extractSection(markdown: string, heading: string): string | undefined {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
  const match = markdown.match(re);
  return match?.[1]?.trim();
}

export function normalizeIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return '';
}

export function daysBetween(iso: string, now: Date): number {
  if (!iso) return 0;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  const ms = now.getTime() - then.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
