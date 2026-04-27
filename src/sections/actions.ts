import type { ReportData } from '../render.js';

export function renderActionsSection(data: ReportData): string {
  const lines = ['═══ 🎯 现在该做什么 ═══'];
  lines.push('1. 处理超期未审：openclaw-learn review list --status pending');
  lines.push('2. 详情：openclaw-learn review show <ID>');
  return lines.join('\n');
}
