import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { titleForCandidate } from './domain-titles.js';
import { aggregateByState, findStaleBacklog, loadAllCandidates, shortId, type Candidate, type CandidateStateCounts } from './loaders/candidate-loader.js';
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
  candidates_summary?: {
    pending?: number;
    reviewing?: number;
    shadow?: number;
    graduated?: number;
  };
  errors: string[];
}

export interface RenderCandidateCard extends Pick<Candidate, 'id' | 'short_id' | 'problem_category' | 'state' | 'age_days'> {
  title: string;
  trigger_summary?: string;
}

export interface DroppedGroup {
  reason: string;
  label: string;
  count: number;
  items: string[];
}

export interface ReportData {
  date: string;
  reflection: {
    events_collected: number;
    candidates_generated: number;
    candidates_dropped: number;
    duration_seconds: number;
    dropped_summary?: Record<string, number>;
    dropped_items?: DroppedItem[];
  };
  new_candidates: RenderCandidateCard[];
  candidates_by_state: CandidateStateCounts;
  total_candidates: number;
  stale_backlog: Candidate[];
  dropped_groups: DroppedGroup[];
  errors: string[];
  version: string;
  stale_days: number;
}

export interface ReporterConfigRuntime {
  stale_days?: number;
}

export function loadReporterConfig(workspaceDir: string): ReporterConfigRuntime {
  const configPath = join(workspaceDir, 'learn', 'reporter-config.json');
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as ReporterConfigRuntime;
    return raw ?? {};
  } catch {
    return {};
  }
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

function groupDroppedItems(items: DroppedItem[]): DroppedGroup[] {
  const grouped = new Map<string, string[]>();
  for (const item of items) {
    const key = item.reason || 'unknown';
    const list = grouped.get(key) ?? [];
    list.push(summarizeDroppedItem(item));
    grouped.set(key, list);
  }

  return [...grouped.entries()].map(([reason, summaries]) => ({
    reason,
    label: droppedReasonLabel(reason),
    count: summaries.length,
    items: summaries,
  }));
}

export function firstSentence(text?: string, maxLength = 60): string | undefined {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;
  const sentence = trimmed.split(/(?<=[。！？!?])\s+/)[0] ?? trimmed;
  if (sentence.length <= maxLength) return sentence;
  return `${sentence.slice(0, maxLength)}…`;
}

export function isSameDay(dateIso: string, dayIso: string): boolean {
  return !!dateIso && dateIso.slice(0, 10) === dayIso;
}

export interface AssembleOptions {
  event: ReflectionEvent;
  workspaceDir?: string;
  now?: Date;
  candidates?: Candidate[];
  staleDays?: number;
}

export function assembleReportData(opts: AssembleOptions): ReportData {
  const { event } = opts;
  const now = opts.now ?? new Date();
  const workspaceDir = opts.workspaceDir ?? event.workspace;
  const config = loadReporterConfig(workspaceDir);
  const staleDays = opts.staleDays ?? config.stale_days ?? 4;
  const candidates = opts.candidates ?? loadAllCandidates(workspaceDir, now);
  const date = event.timestamp.slice(0, 10);
  const newCandidateIds = new Set(event.reflection.new_candidate_ids ?? []);

  const newCandidates = candidates
    .filter(candidate => newCandidateIds.has(candidate.id) || isSameDay(candidate.created_at, date))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(candidate => ({
      id: candidate.id,
      short_id: candidate.short_id,
      problem_category: candidate.problem_category,
      state: candidate.state,
      age_days: candidate.age_days,
      title: titleForCandidate(candidate),
      trigger_summary: firstSentence(candidate.trigger_conditions),
    } satisfies RenderCandidateCard));

  const candidatesByState = aggregateByState(candidates);
  const staleBacklog = findStaleBacklog(candidates, staleDays);

  return {
    date,
    reflection: {
      events_collected: event.reflection.events_collected,
      candidates_generated: event.reflection.candidates_generated,
      candidates_dropped: event.reflection.candidates_dropped,
      duration_seconds: event.reflection.duration_ms / 1000,
      dropped_summary: event.reflection.dropped_summary,
      dropped_items: event.reflection.dropped_items,
    },
    new_candidates: newCandidates,
    candidates_by_state: candidatesByState,
    total_candidates: candidates.length,
    stale_backlog: staleBacklog,
    dropped_groups: groupDroppedItems(event.reflection.dropped_items ?? []),
    errors: event.errors,
    version: '0.4.0',
    stale_days: staleDays,
  };
}

function renderStaleBacklogSection(data: ReportData): string {
  const title = `═══ ⏰ 超期未审 (≥${data.stale_days} 天) ═══`;
  if (data.stale_backlog.length === 0) {
    return [title, '当前没有超期未审候选。'].join('\n');
  }

  return [
    title,
    ...data.stale_backlog.map(candidate => [
      `▸ ${titleForCandidate(candidate)} [${candidate.state} · ${candidate.age_days} 天前]`,
      candidate.trigger_conditions ? `   触发：${firstSentence(candidate.trigger_conditions)}` : undefined,
      `   ID: ${shortId(candidate.id)}`,
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
}

function renderErrorsSection(data: ReportData): string {
  if (data.errors.length === 0) return '';
  return ['═══ ❗ 错误 ═══', ...data.errors.map(error => `- ${error}`)].join('\n');
}

export function renderFromData(data: ReportData): string {
  const sections = [
    `📚 学习闭环日报｜${data.date}`,
    '',
    renderOverviewSection(data),
    renderNewCandidatesSection(data),
    renderDroppedSection({
      candidatesDropped: data.reflection.candidates_dropped,
      droppedGroups: data.dropped_groups,
    }),
    renderCumulativeSection(data),
    renderStaleBacklogSection(data),
    renderActionsSection(data),
    renderErrorsSection(data),
    `🤖 by learning-loop-reporter v${data.version}`,
  ].filter(Boolean);

  return `${sections.join('\n\n')}\n`;
}

export function renderReport(opts: AssembleOptions): string {
  return renderFromData(assembleReportData(opts));
}
