// src/render.ts — Template renderer for reflection events (v0.2.0)
// Renders three-section daily report: metrics + content + actions

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  domain: string;
  confidence: number;
  status: string;
  summary: string;
  trigger_event_summary?: string;
  created_at: string;
}

export interface RenderData {
  date: string;
  events_collected: number;
  candidates_generated: number;
  candidates_dropped: number;
  duration_seconds: string;

  has_new_candidates: boolean;
  new_candidates: Array<CandidateInfo & { index: number }>;

  has_dropped: boolean;
  dropped_breakdown: Array<{ reason: string; count: number }>;
  dropped_items_top3: DroppedItem[];

  status_pending: number;
  status_reviewing: number;
  status_shadow: number;
  status_graduated: number;

  has_high_conf_backlog: boolean;
  high_conf_backlog: Array<{ id: string; confidence: number; age_label: string }>;

  errors_present: boolean;
  errors: string[];
}

// ─── Candidate loading ───────────────────────────────────────────────────────

/** Load candidate info from the SQLite store via the learning-loop API */
export function loadCandidateFromDb(
  candidatesDir: string,
  candidateId: string,
): CandidateInfo | null {
  // Scan date directories for the candidate markdown file
  if (!existsSync(candidatesDir)) return null;

  const shortId = candidateId.slice(0, 15);
  const dateDirs = readdirSync(candidatesDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

  for (const dateDir of dateDirs) {
    const dirPath = join(candidatesDir, dateDir);
    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        // File format: sha256:X-problem_category.md where X matches shortId start
        const content = readFileSync(join(dirPath, file), 'utf-8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm = fmMatch[1]!;

        // Check if this is the right candidate
        const idMatch = fm.match(/^id:\s*(.+)$/m);
        if (!idMatch) continue;
        const fileId = idMatch[1]!.trim();
        if (fileId !== candidateId) continue;

        // Parse frontmatter
        const get = (key: string): string | undefined => {
          const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
          return m?.[1]?.trim();
        };

        return {
          id: truncateId(candidateId),
          domain: get('problem_category') ?? get('scope') ?? 'unknown',
          confidence: parseFloat(get('confidence') ?? '0.5'),
          status: get('state') ?? 'pending',
          summary: get('summary') ?? '(no summary - candidate from older version)',
          trigger_event_summary: get('trigger_event_summary'),
          created_at: get('created_at') ?? new Date().toISOString(),
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** Load candidate from SQLite DB directly */
export function loadCandidateFromSqlite(
  dbPath: string,
  candidateId: string,
): CandidateInfo | null {
  // We'll use a simpler approach: exec sqlite3 query
  try {
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const query = `SELECT json FROM candidates WHERE strategy_id = '${candidateId.replace(/'/g, "''")}' LIMIT 1`;
    const result = execSync(`sqlite3 '${dbPath}' "${query}"`, {
      timeout: 5000,
      encoding: 'utf-8',
    }).trim();
    if (!result) return null;
    const data = JSON.parse(result);
    const strategy = data.strategy ?? data;
    return {
      id: truncateId(candidateId),
      domain: strategy.problem_category ?? strategy.scope ?? 'unknown',
      confidence: strategy.confidence ?? 0.5,
      status: data.state ?? 'pending',
      summary: strategy.summary ?? '(no summary - candidate from older version)',
      trigger_event_summary: strategy.trigger_event?.summary,
      created_at: strategy.created_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function truncateId(id: string): string {
  // sha256:68b21d20a87ab... → sha256:68b21...
  if (id.startsWith('sha256:') && id.length > 20) {
    return id.slice(0, 18) + '…';
  }
  return id;
}

// ─── Age label ───────────────────────────────────────────────────────────────

export function computeAgeLabel(createdAt: string, now?: Date): string {
  const created = new Date(createdAt);
  const today = now ?? new Date();
  const diffMs = today.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 1) return '今日新增';
  if (diffDays <= 3) return `${diffDays} 天未审`;
  return `⚠️ ${diffDays} 天未审`;
}

// ─── Data assembly ───────────────────────────────────────────────────────────

export interface AssembleOptions {
  event: ReflectionEvent;
  candidatesDir?: string;
  dbPath?: string;
  now?: Date;
  /** Pre-loaded candidates (for testing) */
  candidateLoader?: (id: string) => CandidateInfo | null;
  /** Pre-loaded backlog (for testing) */
  backlogLoader?: () => CandidateInfo[];
}

export function assembleRenderData(opts: AssembleOptions): RenderData {
  const { event } = opts;
  const date = event.timestamp.split('T')[0] ?? event.timestamp;
  const durationSeconds = (event.reflection.duration_ms / 1000).toFixed(1);
  const now = opts.now ?? new Date();

  // Load new candidates
  const newCandidateIds = event.reflection.new_candidate_ids ?? [];
  const loadCandidate = opts.candidateLoader ?? ((id: string) => {
    if (opts.dbPath) {
      const c = loadCandidateFromSqlite(opts.dbPath, id);
      if (c) return c;
    }
    if (opts.candidatesDir) {
      return loadCandidateFromDb(opts.candidatesDir, id);
    }
    return null;
  });

  const newCandidates = newCandidateIds.map((id, i) => {
    const info = loadCandidate(id);
    return {
      index: i + 1,
      id: info?.id ?? truncateId(id),
      domain: info?.domain ?? 'unknown',
      confidence: info?.confidence ?? 0.5,
      status: info?.status ?? 'pending',
      summary: info?.summary ?? '(no summary - candidate from older version)',
      trigger_event_summary: info?.trigger_event_summary,
      created_at: info?.created_at ?? now.toISOString(),
    };
  });

  // Dropped breakdown
  const droppedSummary = event.reflection.dropped_summary ?? {};
  const droppedBreakdown = Object.entries(droppedSummary)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Dropped items top 3
  const droppedItems = event.reflection.dropped_items ?? [];
  const droppedItemsTop3 = selectTop3DroppedItems(droppedItems);

  // High confidence backlog
  const loadBacklog = opts.backlogLoader ?? (() => {
    // Scan all pending candidates from markdown files
    if (!opts.candidatesDir || !existsSync(opts.candidatesDir)) return [];
    const results: CandidateInfo[] = [];
    try {
      const dateDirs = readdirSync(opts.candidatesDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
      for (const dateDir of dateDirs) {
        const dirPath = join(opts.candidatesDir, dateDir);
        try {
          const files = readdirSync(dirPath).filter(f => f.endsWith('.md'));
          for (const file of files) {
            try {
              const content = readFileSync(join(dirPath, file), 'utf-8');
              const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
              if (!fmMatch) continue;
              const fm = fmMatch[1]!;
              const get = (key: string) => fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
              const state = get('state');
              if (state !== 'pending') continue;
              const conf = parseFloat(get('confidence') ?? '0');
              if (conf < 0.7) continue;
              results.push({
                id: truncateId(get('id') ?? file),
                domain: get('problem_category') ?? 'unknown',
                confidence: conf,
                status: 'pending',
                summary: get('summary') ?? '(no summary)',
                created_at: get('created_at') ?? now.toISOString(),
              });
            } catch { continue; }
          }
        } catch { continue; }
      }
    } catch { /* ignore */ }
    return results;
  });
  const backlog = loadBacklog();
  const highConfBacklog = backlog
    .filter(c => c.confidence >= 0.7 && c.status === 'pending')
    .map(c => ({
      id: c.id,
      confidence: c.confidence,
      age_label: computeAgeLabel(c.created_at, now),
    }));

  return {
    date,
    events_collected: event.reflection.events_collected,
    candidates_generated: event.reflection.candidates_generated,
    candidates_dropped: event.reflection.candidates_dropped,
    duration_seconds: durationSeconds,

    has_new_candidates: newCandidates.length > 0,
    new_candidates: newCandidates,

    has_dropped: droppedBreakdown.length > 0,
    dropped_breakdown: droppedBreakdown,
    dropped_items_top3: droppedItemsTop3,

    status_pending: event.candidates_summary.pending,
    status_reviewing: event.candidates_summary.reviewing,
    status_shadow: event.candidates_summary.shadow,
    status_graduated: event.candidates_summary.graduated,

    has_high_conf_backlog: highConfBacklog.length > 0,
    high_conf_backlog: highConfBacklog,

    errors_present: event.errors.length > 0,
    errors: event.errors,
  };
}

/** Select top 3 dropped items with diversity by reason */
function selectTop3DroppedItems(items: DroppedItem[]): DroppedItem[] {
  if (items.length <= 3) return items;

  // Pick one from each unique reason first, then fill
  const byReason = new Map<string, DroppedItem[]>();
  for (const item of items) {
    const key = item.reason;
    if (!byReason.has(key)) byReason.set(key, []);
    byReason.get(key)!.push(item);
  }

  const result: DroppedItem[] = [];
  // One from each reason
  for (const [, group] of byReason) {
    if (result.length >= 3) break;
    // Prefer items with longer summaries
    const sorted = [...group].sort((a, b) => (b.summary?.length ?? 0) - (a.summary?.length ?? 0));
    result.push(sorted[0]!);
  }
  // Fill remaining
  for (const item of items) {
    if (result.length >= 3) break;
    if (!result.includes(item)) result.push(item);
  }
  return result;
}

// ─── Template rendering ──────────────────────────────────────────────────────

export function renderFromData(data: RenderData): string {
  const lines: string[] = [];
  const p = (s: string) => lines.push(s);

  p(`📚 自学习闭环日报 ${data.date}`);
  p('');
  p('📊 反思摘要');
  p(`- 采集 events: ${data.events_collected} | 新增 ${data.candidates_generated} | dropped ${data.candidates_dropped} | 耗时 ${data.duration_seconds}s`);

  if (data.has_new_candidates) {
    p('');
    p(`🆕 今日新增候选 (${data.candidates_generated})`);
    p('');
    for (const c of data.new_candidates) {
      p(`【${c.index}】${c.id}`);
      p(`  conf: ${c.confidence} | domain: ${c.domain} | status: ${c.status}`);
      p(`  📝 ${c.summary}`);
      if (c.trigger_event_summary) {
        p(`  💭 触发：${c.trigger_event_summary}`);
      }
      p(`  ➜ openclaw-learn review show ${c.id}`);
      p('');
    }
  }

  if (data.has_dropped) {
    p('');
    p(`⚠️ 今日 dropped 候选 (${data.candidates_dropped})`);
    p('');
    p('按原因聚合：');
    for (const b of data.dropped_breakdown) {
      p(`- ${b.reason} × ${b.count}`);
    }
    if (data.dropped_items_top3.length > 0) {
      p('');
      p('具体内容（前 3 条）：');
      for (const item of data.dropped_items_top3) {
        p(`- [${item.reason}] ${item.summary ?? '(no detail)'}`);
      }
    }
    p(`  ➜ 完整列表: openclaw-learn audit dropped --date ${data.date}`);
  }

  p('');
  p('📈 累计候选状态');
  p(`- pending: ${data.status_pending} | reviewing: ${data.status_reviewing} | shadow: ${data.status_shadow} | graduated: ${data.status_graduated}`);

  if (data.has_high_conf_backlog) {
    p('');
    p('🔥 待你审核的高分候选 (≥ 0.7)');
    for (const c of data.high_conf_backlog) {
      p(`- ${c.id} | conf ${c.confidence} | ${c.age_label}`);
    }
    p('  ➜ 批量审核: openclaw-learn review list --status pending --min-conf 0.7');
  }

  if (data.errors_present) {
    p('');
    p('❗ 本次有错误');
    for (const e of data.errors) {
      p(`- ${e}`);
    }
  }

  p('');
  p('📁 详情命令');
  p('- openclaw-learn review show <id>');
  p('- openclaw-learn audit dropped --date YYYY-MM-DD');
  p('');
  p('🤖 by learning-loop-reporter v0.2.0');

  return lines.join('\n') + '\n';
}

/** Convenience: assemble + render in one call */
export function renderReport(opts: AssembleOptions): string {
  const data = assembleRenderData(opts);
  return renderFromData(data);
}

export function loadDefaultTemplate(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const tmplPath = resolve(__dirname, '..', 'templates', 'daily-report.tmpl');
  return readFileSync(tmplPath, 'utf-8');
}
