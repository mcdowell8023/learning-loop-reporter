import type { DroppedGroup } from '../render.js';

export function renderDroppedSection(data: { candidatesDropped: number; droppedGroups: DroppedGroup[] }): string {
  if (data.candidatesDropped === 0) {
    return ['═══ ⚠️ 被丢弃 (0) ═══', '今日没有被丢弃的候选。'].join('\n');
  }

  const blocks = data.droppedGroups.flatMap(group => [
    `${group.label} (${group.count})`,
    ...group.items.map(item => `   • ${item}`),
    '',
  ]);

  while (blocks[blocks.length - 1] === '') blocks.pop();
  return [`═══ ⚠️ 被丢弃 (${data.candidatesDropped}) ═══`, ...blocks].join('\n');
}
