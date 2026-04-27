import type { RenderData } from '../render.js';

export function renderCumulativeSection(data: RenderData): string {
  return ['═══ 📊 累计 ═══', `pending ${data.counts.pending} · reviewing ${data.counts.reviewing} · shadow ${data.counts.shadow} · graduated ${data.counts.graduated}`].join('\n');
}
