import type { RenderData, RenderCandidateCard } from '../render.js';

function renderCard(card: RenderCandidateCard): string {
  const lines = [`▸ ${card.title} [${card.status} · conf ${card.confidence}]`];
  if (card.trigger) lines.push(`   触发：${card.trigger}`);
  if (card.note) lines.push(`   说明：${card.note}`);
  lines.push(`   ID: ${card.shortId}`);
  return lines.join('\n');
}

export function renderNewCandidatesSection(data: RenderData): string {
  if (data.newCandidates.length === 0) {
    return ['═══ 🆕 新候选 ═══', '今天没有新候选。'].join('\n');
  }

  return ['═══ 🆕 新候选 ═══', ...data.newCandidates.map(renderCard)].join('\n\n');
}
