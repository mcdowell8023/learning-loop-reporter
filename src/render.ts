import type { DailyReport } from './loaders/daily-report-loader.js';

const MAX_FEISHU_CHARS = 30000;
const TARGET_SECTIONS = [
  '## 📊 总览',
  '## 🆕 今日新增候选',
  '## ⚠️ 被丢弃的候选',
  '## ⏰ 超期未审（pending ≥ 4 天）',
  '## 🎯 行动建议',
] as const;

const STATE_LABELS: Record<string, string> = {
  pending: '待审',
  reviewing: '审核中',
  shadow: '影子验证',
  graduated: '已毕业',
  dropped: '已丢弃',
};

const TITLE_LABELS: Record<string, string> = {
  cron_heartbeat_write_noise: 'Cron 心跳写日志噪音',
  'Cron Heartbeat Write Noise': 'Cron 心跳写日志噪音',
  heartbeat_gate_misuse: '误用 HEARTBEAT gate',
  'Heartbeat Gate Misuse': '误用 HEARTBEAT gate',
  heartbeat_rule_adherence: 'HEARTBEAT 规则遵循',
  'Heartbeat Rule Adherence': 'HEARTBEAT 规则遵循',
  avoid_heartbeat_noise_messaging: '避免心跳噪音消息',
  'Avoid Heartbeat Noise Messaging': '避免心跳噪音消息',
  cron_safety_pause_compliance: 'Cron 安全暂停遵循',
  'Cron Safety Pause Compliance': 'Cron 安全暂停遵循',
  reporter_wrapper_atomicity: 'Reporter 包装器原子性',
  'Reporter Wrapper Atomicity': 'Reporter 包装器原子性',
  subagent_output_format_exactness: '子代理输出格式精确性',
  'Subagent Output Format Exactness': '子代理输出格式精确性',
  subagent_output_format_enforcement: '子代理输出格式约束执行',
  'Subagent Output Format Enforcement': '子代理输出格式约束执行',
  pause_on_blocking_clear_instruction: '遇阻即暂停规则',
  'Pause On Blocking Clear Instruction': '遇阻即暂停规则',
};

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

function formatStateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}

function humanizeSlug(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCandidateTitle(rawTitle: string, slug?: string): string {
  if (slug && TITLE_LABELS[slug]) return TITLE_LABELS[slug];
  if (rawTitle && TITLE_LABELS[rawTitle]) return TITLE_LABELS[rawTitle];
  if (slug) return humanizeSlug(slug);
  return rawTitle;
}

function formatOverviewSection(section: string): string {
  return section.replace(
    /(\*\*候选库总数：\*\*\s+\d+（)([^)]+)(）)/,
    (_, prefix: string, states: string, suffix: string) => {
      const localized = states
        .split('/')
        .map(part => part.trim())
        .map(part => {
          const match = part.match(/^(\w+)\s+(\d+)$/);
          if (!match) return part;
          return `${formatStateLabel(match[1] ?? '')} ${match[2] ?? ''}`;
        })
        .join(' / ');
      return `${prefix}${localized}${suffix}`;
    },
  );
}

function summarizeStateCounts(report: DailyReport): string {
  const states = Object.entries(report.meta.candidates_by_state ?? {});
  if (states.length === 0) return `${report.meta.total_candidates} 条`;
  return `${report.meta.total_candidates} 条（${states.map(([state, count]) => `${formatStateLabel(state)} ${count}`).join(' / ')}）`;
}

const SNAPSHOT_TOP_N = 3;
const SNAPSHOT_HEADER_ROW = '| ID | 标题 | 状态 | 创建于 | 龄期 |';
const SNAPSHOT_DIVIDER_ROW = '|----|------|------|--------|------|';

interface SnapshotRow {
  raw: string;
  createdAt: string;
  originalIndex: number;
}

function extractSnapshotRows(report: DailyReport): SnapshotRow[] | null {
  const section = collectSection(splitLines(report.body), '## 📚 候选库快照');
  if (!section) return null;
  const lines = section.split('\n');
  const headerIdx = lines.findIndex(line => line.trim().startsWith('| ID '));
  if (headerIdx < 0) return [];
  const rows: SnapshotRow[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim().startsWith('|')) break;
    const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length < 5) continue;
    const title = cells[1] ?? '';
    const state = cells[2] ?? '';
    const normalizedRaw = `| ${cells[0] ?? ''} | ${formatCandidateTitle(title)} | ${formatStateLabel(state)} | ${cells[3] ?? ''} | ${cells[4] ?? ''} |`;
    rows.push({
      raw: normalizedRaw,
      createdAt: cells[3] ?? '',
      originalIndex: rows.length,
    });
  }
  return rows;
}

function pickRecentRows(rows: SnapshotRow[], n: number): SnapshotRow[] {
  // 先按“最新”语义选中 N 条：日期更新的优先；同日期时文件靠后的优先。
  const picked = [...rows]
    .sort((a, b) => {
      if (a.createdAt === b.createdAt) return b.originalIndex - a.originalIndex;
      return a.createdAt < b.createdAt ? 1 : -1;
    })
    .slice(0, n);

  // 选中后按原文件顺序恢复展示，确保 preview 与日报文件中的表格顺序一致。
  return picked.sort((a, b) => a.originalIndex - b.originalIndex);
}

function buildSnapshotSummary(report: DailyReport): string {
  const counts = summarizeStateCounts(report);
  const rows = extractSnapshotRows(report);

  // 1) 报告里根本没有「候选库快照」段落 → 沿用历史降级文案（向下兼容）
  if (rows === null) {
    return `## 📚 候选库快照\n候选库共 ${counts}。表格已省略，查看完整报告。`;
  }

  // 2) 段落存在但 0 行候选（学习闭环刚启动等场景）→ 只显示总数行
  if (rows.length === 0) {
    return `## 📚 候选库快照\n候选库共 ${counts}。`;
  }

  // 3) 候选数 ≤ 3：全部显示，保持原文件顺序
  if (rows.length <= SNAPSHOT_TOP_N) {
    const tableLines = [SNAPSHOT_HEADER_ROW, SNAPSHOT_DIVIDER_ROW, ...rows.map(r => r.raw)];
    return `## 📚 候选库快照\n候选库共 ${counts}。\n\n${tableLines.join('\n')}`;
  }

  // 4) 候选数 > 3：显示最近 3 条 + 提示
  const recent = pickRecentRows(rows, SNAPSHOT_TOP_N);
  const tableLines = [SNAPSHOT_HEADER_ROW, SNAPSHOT_DIVIDER_ROW, ...recent.map(r => r.raw)];
  return `## 📚 候选库快照\n候选库共 ${counts}。仅显示最近 ${SNAPSHOT_TOP_N} 条，完整表格见附件。\n\n${tableLines.join('\n')}`;
}

function formatNewCandidatesSection(section: string): string {
  const lines = section.split('\n');
  const out: string[] = [];
  let currentSlug = '';

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(\d+)\.\s+(.+?)\s+`([^`]+)`\s*$/);
    if (headingMatch) {
      currentSlug = headingMatch[3] ?? '';
      out.push(`### ${headingMatch[1]}. ${formatCandidateTitle(headingMatch[2] ?? '', currentSlug)}`);
      continue;
    }

    const stateMatch = line.match(/^(\-\s+\*\*状态：\*\*\s+)(\w+)(.*)$/);
    if (stateMatch) {
      out.push(`${stateMatch[1]}${formatStateLabel(stateMatch[2] ?? '')}${stateMatch[3] ?? ''}`);
      continue;
    }

    if (/^\*\*建议行动：\*\*/.test(line)) {
      out.push('**建议行动：**');
      continue;
    }

    if (/^>\s*直接 NO_REPLY 退出/.test(line)) {
      out.push('> 当前建议：无实质业务活动时直接静默退出；只有出现真实业务事件时才写简短日记。');
      continue;
    }

    if (/^>\s*在每次指令到来时先检查 HEARTBEAT\.md/.test(line)) {
      out.push('> 当前建议：先判断这是不是心跳场景，再决定是静默、记账还是升级处理。');
      continue;
    }

    if (/^\*\*断言：\*\*/.test(line)) {
      out.push('**验证方式：**');
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

function buildActionSection(report: DailyReport): string {
  const pending = report.meta.candidates_by_state?.pending ?? 0;
  const stale = report.meta.stale_backlog ?? 0;
  const added = report.meta.new_candidates_today ?? 0;
  const actions: string[] = ['## 🎯 行动建议'];

  if (added > 0) {
    actions.push('', `1. 今天新增 ${added} 条候选，优先先审新候选，避免继续堆积。`);
  }
  if (stale > 0) {
    actions.push(`${actions.length > 2 ? actions.filter(l=>/^\d+\./.test(l)).length + 1 : 2}. 当前有 ${stale} 条超期未审，先清理 backlog。`);
  }
  if (pending > 10) {
    actions.push(`${actions.filter(l=>/^\d+\./.test(l)).length + 1}. 候选库已累积 ${pending} 条待审，建议今天至少完成一轮 review。`);
  }
  if (actions.filter(l => /^\d+\./.test(l)).length === 0) {
    actions.push('', '1. 今日无明显阻塞，继续观察下一轮日报。');
  }

  return actions.join('\n');
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
    if (section) {
      if (heading === '## 📊 总览') {
        blocks.push(formatOverviewSection(section));
      } else if (heading === '## 🆕 今日新增候选') {
        blocks.push(formatNewCandidatesSection(section));
      } else if (heading === '## 🎯 行动建议') {
        blocks.push(buildActionSection(report));
      } else {
        blocks.push(section);
      }
    }
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
