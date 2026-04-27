import type { ReportData } from '../render.js';

export function renderCumulativeSection(data: ReportData): string {
  return [
    `═══ 📊 候选库总览 (共 ${data.total_candidates}) ═══`,
    `pending ${data.candidates_by_state.pending} · reviewing ${data.candidates_by_state.reviewing} · shadow ${data.candidates_by_state.shadow} · graduated ${data.candidates_by_state.graduated}`,
  ].join('\n');
}
