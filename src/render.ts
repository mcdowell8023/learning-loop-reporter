import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { shortId, titleForCandidate } from './domain-titles.js';
import { renderActionsSection } from './sections/actions.js';
import { renderCumulativeSection } from './sections/cumulative.js';
import { renderDroppedSection } from './sections/dropped.js';
import { renderNewCandidatesSection } from './sections/new-candidates.js';
import { renderOverviewSection } from './sections/overview.js';

export interface DroppedItem {
  attempted_id?: string | null;
  reason: string;
  reason_detail?: string;
  summary?: string | null;
}

export interface ReflectionEvent {
  event: string;
  version: string;
  timestamp: string;
  runtime: string;
  workspace: string;
  reflection: {
    from: string | null;
    to: string | null;
    watermark_before: string | null;
    watermark_after: string | null;
    duration_ms: number;
    events_collected: number;
    candidates_generated: number;
    candidates_dropped: number;
    dropped_summary?: Record<string, number>;
    dropped_items?: DroppedItem[];
    reasons_triggered: string[];
    new_candidate_ids?: string[];
  };
  candidates_summary: {
    pending: number;
    reviewing: number;
    shadow: number;
    graduated: number;
    high_confidence: Array<{ id: string; domain: string; confidence: number }>;
  };
  errors: string[];
}

export interface CandidateInfo {
  id: string;
  domain?: string;
  confidence: number;
  status: string;
  summary?: string;
  trigger_event_summary?: string;
  created_at: string;
}

export interface RenderCandidateCard {
  title: string;
  shortId: string;
  status: string;
  confidence: number;
  trigger?: string;
  note?: string;
}

export interface DroppedGroup {
  reason: string;
  label: string;
  count: number;
  items: string[];
}

export interface HighConfidenceBacklogItem {
  id: string;
  shortId: string;
  confidence: number;
  ageDays: number;
}

export interface RenderData {
  date: string;
  version: string;
  eventsCollected: number;
  candidatesGenerated: number;
  candidatesDropped: number;
  durationSeconds: string;
  newCandidates: RenderCandidateCard[];
  droppedGroups: DroppedGroup[];
  counts: {
    pending: number;
    reviewing: number;
    shadow: number;
    graduated: number;
  };
  backlog: HighConfidenceBacklogItem[];
  errors: string[];
}

export interface AssembleOptions {
  event: ReflectionEvent;
  candidatesDir?: string;
  now?: Date;
  candidateLoader?: (id: string) => CandidateInfo | null;
  backlogLoader?: () => CandidateInfo[];
}

export function loadCandidateFromDb(candidatesDir: string, candidateId: string): CandidateInfo | null {
  if (!existsSync(candidatesDir)) return null;
  const dateDirs = readdirSync(candidatesDir).filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));

  for (const dateDir of dateDirs) {
    const dirPath = join(candidatesDir, dateDir);
    const files = readdirSync(dirPath).filter(file => file.endsWith('.md'));
    for (const file of files) {
      const fullPath = join(dirPath, file);
      const content = readFileSync(fullPath, 'utf8');
      const frontmatter = parseFrontmatter(content);
      if (!frontmatter || frontmatter.id !== candidateId) continue;
      return {
        id: candidateId,
        domain: frontmatter.problem_category ?? frontmatter.scope ?? 'unknown',
        confidence: parseFloat(frontmatter.confidence ?? '0.5'),
        status: frontmatter.state ?? 'pending',
        summary: frontmatter.summary ?? '(no summary - candidate from older version)',
        trigger_event_summary: frontmatter.trigger_event_summary,
        created_at: frontmatter.created_at ?? new Date().toISOString(),
      };
    }
  }

  return null;
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) result[kv[1]] = kv[2];
  }
  return result;
}

export function computeAgeDays(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt);
  return Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
}

function droppedReasonLabel(reason: string): string {
  switch (reason) {
    case 'duplicate':
      return '🔁 重复';
    case 'low_confidence':
      return '📉 置信度低';
    case 'low_signal':
      return '📉 信号太弱';
    case 'schema_invalid':
      return '🚫 格式错误';
    default:
      return `❓ ${reason}`;
  }
}

function summarizeDroppedItem(item: DroppedItem): string {
  return item.summary?.trim() || item.reason_detail?.trim() || '(no detail)';
}

export function assembleRenderData(opts: AssembleOptions): RenderData {
  const { event } = opts;
  const now = opts.now ?? new Date();
  const date = event.timestamp.slice(0, 10);
  const loadCandidate = opts.candidateLoader ?? ((id: string) => (opts.candidatesDir ? loadCandidateFromDb(opts.candidatesDir, id) : null));
  const backlogLoader = opts.backlogLoader ?? (() => []);

  const newCandidates = (event.reflection.new_candidate_ids ?? []).map(id => {
    const candidate = loadCandidate(id);
    const fallback: CandidateInfo = candidate ?? {
      id,
      domain: 'unknown',
      confidence: 0.5,
      status: 'pending',
      summary: '(no summary)',
      created_at: now.toISOString(),
    };

    const title = titleForCandidate({ id: fallback.id, summary: fallback.summary, domain: fallback.domain });
    const usedSummaryAsTitle = !!fallback.summary?.trim() && title === titleForCandidate({ id: fallback.id, summary: fallback.summary, domain: fallback.domain }) && title === (fallback.summary!.trim().length > 30 ? `${fallback.summary!.trim().slice(0, 30)}…` : fallback.summary!.trim()) && fallback.summary !== '(no summary)' && !fallback.summary?.includes('no summary - candidate from older version');
    const note = usedSummaryAsTitle ? undefined : (fallback.summary?.trim() || '(no summary)');

    return {
      title,
      shortId: shortId(fallback.id),
      status: fallback.status,
      confidence: fallback.confidence,
      trigger: fallback.trigger_event_summary?.trim() || undefined,
      note,
    } satisfies RenderCandidateCard;
  });

  const droppedGroups = Object.entries(groupDroppedItems(event.reflection.dropped_items ?? [])).map(([reason, items]) => ({
    reason,
    label: droppedReasonLabel(reason),
    count: items.length,
    items,
  }));

  const backlog = backlogLoader()
    .filter(item => item.status === 'pending' && item.confidence >= 0.7)
    .map(item => ({
      id: item.id,
      shortId: shortId(item.id),
      confidence: item.confidence,
      ageDays: computeAgeDays(item.created_at, now),
    }))
    .sort((a, b) => b.ageDays - a.ageDays || b.confidence - a.confidence);

  return {
    date,
    version: '0.3.0',
    eventsCollected: event.reflection.events_collected,
    candidatesGenerated: event.reflection.candidates_generated,
    candidatesDropped: event.reflection.candidates_dropped,
    durationSeconds: (event.reflection.duration_ms / 1000).toFixed(1),
    newCandidates,
    droppedGroups,
    counts: {
      pending: event.candidates_summary.pending,
      reviewing: event.candidates_summary.reviewing,
      shadow: event.candidates_summary.shadow,
      graduated: event.candidates_summary.graduated,
    },
    backlog,
    errors: event.errors,
  };
}

function groupDroppedItems(items: DroppedItem[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    const key = item.reason || 'unknown';
    grouped[key] ??= [];
    grouped[key].push(summarizeDroppedItem(item));
  }
  return grouped;
}

function renderErrorsSection(data: RenderData): string {
  if (data.errors.length === 0) return '';
  return ['═══ ❗ 错误 ═══', ...data.errors.map(error => `- ${error}`)].join('\n');
}

export function renderFromData(data: RenderData): string {
  const sections = [
    `📚 学习闭环日报｜${data.date}`,
    '',
    renderOverviewSection(data),
    renderNewCandidatesSection(data),
    renderDroppedSection(data),
    renderCumulativeSection(data),
    renderActionsSection(data),
    renderErrorsSection(data),
    `🤖 by learning-loop-reporter v${data.version}`,
  ].filter(Boolean);

  return `${sections.join('\n\n')}\n`;
}

export function renderReport(opts: AssembleOptions): string {
  return renderFromData(assembleRenderData(opts));
}
