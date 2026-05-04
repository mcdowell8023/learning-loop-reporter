import type { DailyReport } from './loaders/daily-report-loader.js';

const MAX_FEISHU_CHARS = 30000;
const TARGET_SECTIONS = [
  '## 🎯 行动建议',
  '## 🆕 今日新增候选',
  '## 📊 总览',
  '## ⚠️ 被丢弃的候选',
] as const;

/**
 * 中文/全角字符贪心判定（用于表格等宽对齐）。
 * 保证 CJK + 常见单 emoji 的等宽近似；ZWJ family / variation selector 等复杂 grapheme 不保证精确对齐
 */
function visualWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK 统一 / CJK 扩展 / 全角 ASCII / 假名 / Hangul / 标点
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x303e) ||
      (code >= 0x3041 && code <= 0x33ff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xa000 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faff) // emoji
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function padEnd(text: string, targetWidth: number): string {
  const w = visualWidth(text);
  return w >= targetWidth ? text : text + ' '.repeat(targetWidth - w);
}

/**
 * 将连续的 markdown 表格块（`|...|` 行 + `|---|` 分隔 + 多行数据）转为
 * 等宽 ASCII code block，避免飞书 post 适配器把表格塑缩为单行。
 */
export function convertMarkdownTablesToCodeBlocks(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  let insideFence = false;
  let fencePattern = '';

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Fence-aware state machine: detect opening/closing fenced code blocks
    if (!insideFence) {
      const fenceMatch = line.match(/^(\s*)(```|~~~)/);
      if (fenceMatch) {
        insideFence = true;
        fencePattern = fenceMatch[2]!;
        out.push(line);
        i++;
        continue;
      }
    } else {
      // Inside a fence: check for closing fence (same marker, possibly with trailing text)
      const closeRe = new RegExp(`^\\s*${fencePattern.replace(/`/g, '`')}\\s*$`);
      if (closeRe.test(line)) {
        insideFence = false;
        fencePattern = '';
      }
      out.push(line);
      i++;
      continue;
    }

    const next = lines[i + 1] ?? '';
    const isTableHeader = /^\s*\|.+\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(next);
    if (!isTableHeader) {
      out.push(line);
      i++;
      continue;
    }

    // 收集表格块
    const tableLines: string[] = [line, next];
    let j = i + 2;
    while (j < lines.length && /^\s*\|.+\|\s*$/.test(lines[j] ?? '')) {
      tableLines.push(lines[j]!);
      j++;
    }

    // 解析为单元格（跳过分隔行）
    const parseRow = (raw: string): string[] => raw.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const header = parseRow(tableLines[0]!);
    const dataRows = tableLines.slice(2).map(parseRow);
    const allRows = [header, ...dataRows];
    const colCount = header.length;
    const colWidths: number[] = [];
    for (let c = 0; c < colCount; c++) {
      let max = 0;
      for (const row of allRows) max = Math.max(max, visualWidth(row[c] ?? ''));
      colWidths.push(max);
    }

    const formatRow = (row: string[]): string => row.map((cell, c) => padEnd(cell, colWidths[c] ?? 0)).join('  ');
    const separator = colWidths.map(w => '-'.repeat(w)).join('  ');

    out.push('```');
    out.push(formatRow(header));
    out.push(separator);
    for (const row of dataRows) out.push(formatRow(row));
    out.push('```');
    i = j;
  }

  return out.join('\n');
}

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
  }

  blocks.push(buildFooter(report));
  const joined = `${blocks.join('\n\n').trim()}\n`;
  // T-051 A2：表格转 codeblock，避免飞书 post 塑缩为单行流式文本
  const transformed = convertMarkdownTablesToCodeBlocks(joined);
  return truncateForFeishu(transformed, report.filepath);
}
