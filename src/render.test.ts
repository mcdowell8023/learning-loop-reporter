import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadDailyReportFromPath } from './loaders/daily-report-loader.js';
import { renderForFeishu } from './render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');

function loadFixture(name: string) {
  const filepath = join(fixturesDir, `${name}.md`);
  const report = loadDailyReportFromPath(filepath);
  if (!report) throw new Error(`Fixture not found: ${name}`);
  return report;
}

describe('renderForFeishu', () => {
  it('renders sample report snapshot', () => {
    expect(renderForFeishu(loadFixture('sample-daily-report'))).toMatchSnapshot();
  });

  it('renders empty day snapshot', () => {
    expect(renderForFeishu(loadFixture('empty-day'))).toMatchSnapshot();
  });

  it('renders stale day snapshot', () => {
    expect(renderForFeishu(loadFixture('with-stale'))).toMatchSnapshot();
  });

  it('renders dropped day snapshot', () => {
    expect(renderForFeishu(loadFixture('with-dropped'))).toMatchSnapshot();
  });

  it('keeps title and quote prelude', () => {
    const output = renderForFeishu(loadFixture('sample-daily-report'));
    expect(output).toContain('# 学习闭环日报 · 2026-04-27');
    expect(output).toContain('> Reflect: events=3002');
  });

  it('includes required sections when present', () => {
    const output = renderForFeishu(loadFixture('sample-daily-report'));
    expect(output).toContain('## 📊 总览');
    expect(output).toContain('## 🆕 今日新增候选');
    expect(output).toContain('## ⏰ 超期未审（pending ≥ 4 天）');
    expect(output).toContain('## 🎯 行动建议');
  });

  it('renders snapshot section with recent candidates table', () => {
    const output = renderForFeishu(loadFixture('sample-daily-report'));
    expect(output).toContain('## 📚 候选库快照');
    expect(output).toContain('候选库共 14 条（待审 14）。仅显示最近 3 条，完整表格见附件。');
    expect(output).toContain('| ID | 标题 | 状态 | 创建于 | 龄期 |');
    // 只取 3 行表格 body，验证不超过
    const tableBodyMatches = output.match(/^\| [0-9a-f]{8} \|/gm) ?? [];
    expect(tableBodyMatches.length).toBeLessThanOrEqual(3);
  });

  it('drops Run history sections', () => {
    const output = renderForFeishu(loadFixture('sample-daily-report'));
    expect(output).not.toContain('## Run #1');
    expect(output).not.toContain('events_collected: 2947');
  });

  it('keeps dropped section when present', () => {
    const output = renderForFeishu(loadFixture('with-dropped'));
    expect(output).toContain('## ⚠️ 被丢弃的候选');
    expect(output).toContain('duplicate');
  });

  it('keeps stale section when present', () => {
    const output = renderForFeishu(loadFixture('with-stale'));
    expect(output).toContain('## ⏰ 超期未审（pending ≥ 4 天）');
    expect(output).toContain('超期 2 条');
  });

  it('always appends full report path', () => {
    const report = loadFixture('sample-daily-report');
    const output = renderForFeishu(report);
    expect(output.trimEnd().endsWith(`📁 完整报告：${report.filepath}`)).toBe(true);
  });

  it('truncates overlong messages to 30k', () => {
    const report = loadFixture('sample-daily-report');
    report.body = `# 学习闭环日报 · 2026-04-27\n\n> 生成时间：2026-04-27T08:42:41.404Z\n\n## 🆕 今日新增候选\n\n${'非常长的内容 '.repeat(10000)}\n\n## 🎯 行动建议\n\n1. done`;
    const output = renderForFeishu(report);
    expect(output.length).toBeLessThanOrEqual(30000);
    expect(output).toContain('已截断');
  });
});

describe('snapshot recent rows behavior', () => {
  function makeReport(rows: { id: string; title: string; state: string; createdAt: string; age: string }[], totalOverride?: number) {
    const tableBody = rows.map(r => `| ${r.id} | ${r.title} | ${r.state} | ${r.createdAt} | ${r.age} |`).join('\n');
    const total = totalOverride ?? rows.length;
    return {
      filepath: '/tmp/fake.md',
      meta: {
        date: '2026-04-28',
        reflect_count: 1,
        total_candidates: total,
        candidates_by_state: { pending: total },
        new_candidates_today: 0,
        stale_backlog: 0,
        generated_at: '2026-04-27T23:01:24.216Z',
      },
      body: [
        '# 学习闭环日报 · 2026-04-28',
        '',
        '## 📚 候选库快照',
        '',
        '| ID | 标题 | 状态 | 创建于 | 龄期 |',
        '|----|------|------|--------|------|',
        tableBody,
        '',
        '## 🎯 行动建议',
        '',
        '1. done',
      ].join('\n'),
    };
  }

  it('selects 3 most recent rows when more than 3 candidates', () => {
    const report = makeReport([
      { id: 'aaa11111', title: 'old1', state: 'pending', createdAt: '2026-04-20', age: '8 天' },
      { id: 'bbb22222', title: 'old2', state: 'pending', createdAt: '2026-04-21', age: '7 天' },
      { id: 'ccc33333', title: 'mid1', state: 'pending', createdAt: '2026-04-25', age: '3 天' },
      { id: 'ddd44444', title: 'new1', state: 'pending', createdAt: '2026-04-27', age: '1 天' },
      { id: 'eee55555', title: 'new2', state: 'pending', createdAt: '2026-04-28', age: '0 天' },
    ]);
    const output = renderForFeishu(report);
    expect(output).toContain('仅显示最近 3 条');
    expect(output).toContain('eee55555');
    expect(output).toContain('ddd44444');
    expect(output).toContain('ccc33333');
    expect(output).not.toContain('aaa11111');
    expect(output).not.toContain('bbb22222');
  });

  it('selects the latest rows by file order when createdAt is the same', () => {
    // 同一创建日期下，文件末尾才是最新追加的。
    // 预期：取 ddd44444 / ccc33333 / bbb22222（倒数 3 条）。
    const report = makeReport([
      { id: 'aaa11111', title: 'first-of-day', state: 'pending', createdAt: '2026-04-28', age: '0 天' },
      { id: 'bbb22222', title: 'second-of-day', state: 'pending', createdAt: '2026-04-28', age: '0 天' },
      { id: 'ccc33333', title: 'third-of-day', state: 'pending', createdAt: '2026-04-28', age: '0 天' },
      { id: 'ddd44444', title: 'fourth-of-day', state: 'pending', createdAt: '2026-04-28', age: '0 天' },
    ]);
    const output = renderForFeishu(report);
    expect(output).toContain('ddd44444');
    expect(output).toContain('ccc33333');
    expect(output).toContain('bbb22222');
    expect(output).not.toContain('aaa11111');
  });

  it('still picks latest 3 by createdAt when file order differs from time order', () => {
    // 文件顺序乱：最新的反而在最前，最早的在中间。按 createdAt 取 top-3：
    //   newone01 (04-28) > newone02 (04-27) > newone03 (04-26) > midone01 (04-25) > oldone01 (04-10)
    const report = makeReport([
      { id: 'newone01', title: 'newest-but-first', state: 'pending', createdAt: '2026-04-28', age: '0 天' },
      { id: 'oldone01', title: 'oldest-in-middle', state: 'pending', createdAt: '2026-04-10', age: '18 天' },
      { id: 'midone01', title: 'mid', state: 'pending', createdAt: '2026-04-25', age: '3 天' },
      { id: 'newone02', title: 'second-newest', state: 'pending', createdAt: '2026-04-27', age: '1 天' },
      { id: 'newone03', title: 'third-newest', state: 'pending', createdAt: '2026-04-26', age: '2 天' },
    ]);
    const output = renderForFeishu(report);
    expect(output).toContain('newone01');
    expect(output).toContain('newone02');
    expect(output).toContain('newone03');
    expect(output).not.toContain('midone01');
    expect(output).not.toContain('oldone01');
  });

  it('falls back to last-N file order when all createdAt are missing or identical', () => {
    // createdAt 字段缺失（空串）：全部平手 → 取文件末尾 3 条。
    const report = makeReport([
      { id: 'row00001', title: 'r1', state: 'pending', createdAt: '', age: '?' },
      { id: 'row00002', title: 'r2', state: 'pending', createdAt: '', age: '?' },
      { id: 'row00003', title: 'r3', state: 'pending', createdAt: '', age: '?' },
      { id: 'row00004', title: 'r4', state: 'pending', createdAt: '', age: '?' },
      { id: 'row00005', title: 'r5', state: 'pending', createdAt: '', age: '?' },
    ]);
    const output = renderForFeishu(report);
    expect(output).toContain('row00005');
    expect(output).toContain('row00004');
    expect(output).toContain('row00003');
    expect(output).not.toContain('row00001');
    expect(output).not.toContain('row00002');
  });

  it('shows all rows when total <= 3 without truncation hint', () => {
    const report = makeReport([
      { id: 'aaa11111', title: 't1', state: 'pending', createdAt: '2026-04-26', age: '2 天' },
      { id: 'bbb22222', title: 't2', state: 'pending', createdAt: '2026-04-28', age: '0 天' },
    ]);
    const output = renderForFeishu(report);
    expect(output).not.toContain('仅显示最近');
    expect(output).toContain('aaa11111');
    expect(output).toContain('bbb22222');
  });

  it('renders 0 rows table (empty body) without showing rows or hint', () => {
    const report = {
      filepath: '/tmp/fake.md',
      meta: {
        date: '2026-04-28',
        reflect_count: 0,
        total_candidates: 0,
        candidates_by_state: { pending: 0 },
        new_candidates_today: 0,
        stale_backlog: 0,
        generated_at: '',
      },
      body: [
        '# 学习闭环日报 · 2026-04-28',
        '',
        '## 📚 候选库快照',
        '',
        '| ID | 标题 | 状态 | 创建于 | 龄期 |',
        '|----|------|------|--------|------|',
        '',
        '## 🎯 行动建议',
        '',
        '1. done',
      ].join('\n'),
    };
    const output = renderForFeishu(report);
    expect(output).toContain('## 📚 候选库快照');
    expect(output).toContain('候选库共 0 条（待审 0）。');
    expect(output).not.toContain('仅显示最近');
    expect(output).not.toContain('表格解析失败');
    expect(output).not.toMatch(/^\| [0-9a-f]{8} \|/m);
  });

  it('falls back gracefully when snapshot section is missing entirely', () => {
    const report = {
      filepath: '/tmp/fake.md',
      meta: {
        date: '2026-04-28',
        reflect_count: 0,
        total_candidates: 0,
        candidates_by_state: {},
        new_candidates_today: 0,
        stale_backlog: 0,
        generated_at: '',
      },
      body: '# 学习闭环日报 · 2026-04-28\n\n## 🎯 行动建议\n\n1. done',
    };
    const output = renderForFeishu(report);
    expect(output).toContain('## 📚 候选库快照');
    expect(output).toContain('表格已省略，查看完整报告。');
  });
});
