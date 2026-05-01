import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadDailyReportFromPath } from './loaders/daily-report-loader.js';
import { renderForFeishu, convertMarkdownTablesToCodeBlocks } from './render.js';

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

  it('keeps snapshot section when present (T-051: shown via codeblock)', () => {
    const output = renderForFeishu(loadFixture('sample-daily-report'));
    expect(output).toContain('## 📚 候选库快照');
    // 原始 markdown 表头已被转换为 codeblock，不再出现原始 pipe 表头
    expect(output).not.toContain('| ID | 标题 | 状态 | 创建于 | 龄期 |');
    // 表格被包装在 fenced codeblock 中
    expect(output).toMatch(/```[\s\S]*?```/);
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

});

describe('convertMarkdownTablesToCodeBlocks', () => {

  it('keeps fenced code blocks untouched', () => {
    const input = [
      '```js',
      '| Name | Value |',
      '|------|-------|',
      '| a    | 1     |',
      '```',
    ].join('\n');
    expect(convertMarkdownTablesToCodeBlocks(input)).toBe(input);
  });

  it('handles adjacent tables independently', () => {
    const input = [
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '| X | Y |',
      '|---|---|',
      '| 3 | 4 |',
    ].join('\n');
    const result = convertMarkdownTablesToCodeBlocks(input);
    const fences = result.match(/```/g);
    expect(fences).toHaveLength(4); // 2 open + 2 close
    expect(result).toContain('A');
    expect(result).toContain('X');
  });

  it('aligns CJK and simple emoji reasonably', () => {
    const input = [
      '| 名称 | 状态 |',
      '|------|------|',
      '| 🚀 | OK |',
    ].join('\n');
    const result = convertMarkdownTablesToCodeBlocks(input);
    expect(result).toContain('```');
    // CJK header should be padded
    expect(result).toContain('名称');
    expect(result).toContain('🚀');
  });

});

describe('renderForFeishu', () => {
  it('truncates overlong messages to 30k', () => {
    const report = loadFixture('sample-daily-report');
    report.body = `# 学习闭环日报 · 2026-04-27\n\n> 生成时间：2026-04-27T08:42:41.404Z\n\n## 🆕 今日新增候选\n\n${'非常长的内容 '.repeat(10000)}\n\n## 🎯 行动建议\n\n1. done`;
    const output = renderForFeishu(report);
    expect(output.length).toBeLessThanOrEqual(30000);
    expect(output).toContain('已截断');
  });
});
