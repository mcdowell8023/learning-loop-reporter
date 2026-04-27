import type { RenderData } from '../render.js';

export function renderOverviewSection(data: RenderData): string {
  return ['═══ 总览 ═══', `${data.eventsCollected} events · ${data.candidatesGenerated} 新候选 · ${data.candidatesDropped} 被丢弃 · 耗时 ${data.durationSeconds}s`].join('\n');
}
