import type { RenderData } from '../render.js';

export function renderDroppedSection(data: RenderData): string {
  if (data.candidatesDropped === 0) {
    return ['═══ ⚠️ 被丢弃 (0) ═══', '今天没有被丢弃的候选。'].join('\n');
  }

  const blocks = data.droppedGroups.flatMap(group => [
    `${group.label} (${group.count})`,
    ...group.items.map(item => `   • ${item}`),
    '',
  ]);

  while (blocks[blocks.length - 1] === '') blocks.pop();
  return [`═══ ⚠️ 被丢弃 (${data.candidatesDropped}) ═══`, ...blocks].join('\n');
}
