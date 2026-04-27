import type { RenderData } from '../render.js';

export function renderActionsSection(data: RenderData): string {
  const lines = ['═══ 🎯 现在该做什么 ═══'];
  let index = 1;

  if (data.newCandidates.length > 0) {
    lines.push(`${index}. review 新候选（ID: ${data.newCandidates.map(item => item.shortId).join(' / ')}）`);
    index += 1;
  }

  const overdue = data.backlog.filter(item => item.ageDays >= 4);
  if (overdue.length > 0) {
    lines.push(`${index}. 处理超期未审：openclaw-learn review list --status pending --min-conf 0.7`);
    index += 1;
  }

  lines.push(`${index}. 详情：openclaw-learn review show <ID>`);
  return lines.join('\n');
}
