import type { DailyReport } from './loaders/daily-report-loader.js';

const MAX_FEISHU_CHARS = 30000;
const TARGET_SECTIONS = [
  '## 📊 总览',
  '## 🆕 今日新增候选',
  '## ⚠️ 被丢弃的候选',
  '## ⏰ 超期未审（pending ≥ 4 天）',
  '## 🎯 行动建议',
] as const;

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.trim() === '') start++;
  while (end > start && lines[end - 1]?.trim() === '') end--;
  return lines.slice(start, end);
}

function findHeadingIndex(lines: string[], heading: string): number {
  return lines.findIndex(line => line.trim() === heading);
}

function collectSection(lines: string[], heading: string): string | null {
  const start = findHeadingIndex(lines, heading);
  if (start < 0) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^##\s+/.test(lines[index] ?? '')) {
      end = index;
      break;
    }
  }

  return trimBlankEdges(lines.slice(start, end)).join('\n');
}

function collectIntroBlock(lines: string[]): string[] {
  const titleIndex = lines.findIndex(line => /^#\s+/.test(line));
  if (titleIndex < 0) return [];

  const collected: string[] = [lines[titleIndex]!];
  for (let index = titleIndex + 1; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (/^##\s+/.test(line)) break;
    if (line.trim() === '' || line.trim().startsWith('>')) collected.push(line);
  }

  return trimBlankEdges(collected);
}

function summarizeStateCounts(report: DailyReport): string {
  const states = Object.entries(report.meta.candidates_by_state ?? {});
  if (states.length === 0) return `${report.meta.total_candidates} 条`;
  return `${report.meta.total_candidates} 条（${states.map(([state, count]) => `${state} ${count}`).join(' / ')}）`;
}

function buildSnapshotSummary(report: DailyReport): string {
  return `## 📚 候选库快照\n候选库共 ${summarizeStateCounts(report)}。表格已省略，查看完整报告。`;
}

function buildFooter(report: DailyReport): string {
  return `📁 完整报告：${report.filepath}`;
}

function truncateForFeishu(text: string, filepath: string): string {
  if (text.length <= MAX_FEISHU_CHARS) return text;
  const footer = `\n\n…（飞书消息超出 30k 字符，已截断）\n📁 完整报告：${filepath}`;
  const keep = Math.max(0, MAX_FEISHU_CHARS - footer.length);
  return `${text.slice(0, keep).trimEnd()}${footer}`;
}

export function renderForFeishu(report: DailyReport): string {
  const lines = splitLines(report.body);
  const blocks: string[] = [];
  const intro = collectIntroBlock(lines);
  if (intro.length > 0) blocks.push(intro.join('\n'));

  for (const heading of TARGET_SECTIONS) {
    const section = collectSection(lines, heading);
    if (section) blocks.push(section);
    if (heading === '## ⏰ 超期未审（pending ≥ 4 天）') {
      blocks.push(buildSnapshotSummary(report));
    }
  }

  if (!blocks.some(block => block.startsWith('## 📚 候选库快照'))) {
    blocks.push(buildSnapshotSummary(report));
  }

  blocks.push(buildFooter(report));
  return truncateForFeishu(`${blocks.join('\n\n').trim()}\n`, report.filepath);
}
