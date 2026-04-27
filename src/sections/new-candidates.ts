import type { RenderCandidateCard, ReportData } from '../render.js';

function renderCard(card: RenderCandidateCard): string {
  const ageLabel = `${card.age_days} 天前`;
  const lines = [`▸ ${card.title} [${card.state} · ${ageLabel}]`];
  if (card.trigger_summary) lines.push(`   触发：${card.trigger_summary}`);
  lines.push(`   ID: ${card.short_id}`);
  return lines.join('\n');
}

export function renderNewCandidatesSection(data: ReportData): string {
  if (data.new_candidates.length === 0) {
    return ['═══ 🆕 今日新增候选 ═══', '今日没有新增候选。'].join('\n');
  }

  return ['═══ 🆕 今日新增候选 ═══', ...data.new_candidates.map(renderCard)].join('\n\n');
}
