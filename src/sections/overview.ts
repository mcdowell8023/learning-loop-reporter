import type { ReportData } from '../render.js';

export function renderOverviewSection(data: ReportData): string {
  return [
    '═══ 总览 ═══',
    `${data.reflection.events_collected} events · ${data.reflection.candidates_generated} 新候选 · ${data.reflection.candidates_dropped} 被丢弃 · 耗时 ${data.reflection.duration_seconds.toFixed(1)}s`,
  ].join('\n');
}
