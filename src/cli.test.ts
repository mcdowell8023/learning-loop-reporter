import { describe, expect, it, vi } from 'vitest';
import { runCli, getTodayInShanghai, type CliDeps } from './cli.js';
import type { DailyReport } from './loaders/daily-report-loader.js';
import * as send from './send.js';

const sampleReport: DailyReport = {
  meta: {
    date: '2026-04-27',
    reflect_count: 3,
    total_candidates: 14,
    candidates_by_state: { pending: 14 },
    new_candidates_today: 3,
    stale_backlog: 0,
    generated_at: '2026-04-27T08:42:41.404Z',
  },
  body: '# 学习闭环日报 · 2026-04-27\n\n## 📊 总览\n\n- ok\n\n## 🎯 行动建议\n\n- do it',
  filepath: '/tmp/2026-04-27-daily.md',
};

function createDeps(): { stdout: string[]; stderr: string[]; sendSpy: unknown; deps: Partial<CliDeps> } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const sendSpy = vi.spyOn(send, 'sendToFeishu').mockResolvedValue();

  return {
    stdout,
    stderr,
    sendSpy,
    deps: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
      exit: ((code: number) => { throw new Error(`EXIT:${code}`); }) as never,
      existsSync: vi.fn((path: unknown) => String(path).includes('reporter-config.json')) as unknown as CliDeps['existsSync'],
      loadConfig: vi.fn(() => ({ channels: [{ type: 'feishu', target: 'ou_test' }] })),
      sendToAllChannels: vi.fn(async () => ({ success: true, channels: 1, errors: [] })),
      loadDailyReport: vi.fn(() => sampleReport) as unknown as CliDeps['loadDailyReport'],
      loadDailyReportFromPath: vi.fn(() => sampleReport) as unknown as CliDeps['loadDailyReportFromPath'],
      loadLatestDailyReport: vi.fn(() => sampleReport) as unknown as CliDeps['loadLatestDailyReport'],
      now: () => new Date('2026-04-27T08:55:00+08:00'),
    },
  };
}

describe('cli', () => {
  it('preview uses today date by default', async () => {
    const { stdout, deps } = createDeps();
    await runCli(['preview'], deps).catch(() => undefined);
    expect(deps.loadDailyReport).toHaveBeenCalledWith(expect.any(String), '2026-04-27');
    expect(stdout.join('\n')).toContain('# 学习闭环日报 · 2026-04-27');
  });

  it('preview prefers --report path over --date', async () => {
    const { deps } = createDeps();
    await runCli(['preview', '--date', '2026-04-26', '--report', '/tmp/report.md'], deps).catch(() => undefined);
    expect(deps.loadDailyReportFromPath).toHaveBeenCalledWith('/tmp/report.md');
    expect(deps.loadDailyReport).not.toHaveBeenCalled();
  });

  it('notify sends rendered message through channels', async () => {
    const { stdout, deps, sendSpy } = createDeps();
    await runCli(['notify'], deps).catch(() => undefined);
    expect(deps.sendToAllChannels).toHaveBeenCalledOnce();
    expect(stdout.join('\n')).toContain('✅ Sent daily report to 1 channel');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('health reports latest report and config', async () => {
    const { stdout, deps } = createDeps();
    await runCli(['health'], deps).catch(() => undefined);
    expect(stdout.join('\n')).toContain('✅ Config:');
    expect(stdout.join('\n')).toContain('✅ Latest report:');
  });

  it('errors when report by date is missing but latest exists', async () => {
    const { stderr, deps } = createDeps();
    deps.loadDailyReport = vi.fn(() => null) as unknown as CliDeps['loadDailyReport'];
    await runCli(['preview', '--date', '2026-04-26'], deps).catch(error => expect((error as Error).message).toBe('EXIT:2'));
    expect(stderr.join('\n')).toContain('Latest available: 2026-04-27');
  });

  it('errors when no reports exist at all', async () => {
    const { stderr, deps } = createDeps();
    deps.loadDailyReport = vi.fn(() => null) as unknown as CliDeps['loadDailyReport'];
    deps.loadLatestDailyReport = vi.fn(() => null) as unknown as CliDeps['loadLatestDailyReport'];
    await runCli(['preview'], deps).catch(error => expect((error as Error).message).toBe('EXIT:2'));
    expect(stderr.join('\n')).toContain('Daily report not found for 2026-04-27');
  });

  it('rejects deprecated --event flag', async () => {
    const { stderr, deps } = createDeps();
    await runCli(['preview', '--event', 'x.json'], deps).catch(error => expect((error as Error).message).toBe('EXIT:2'));
    expect(stderr.join('\n')).toContain('Deprecated flags removed in v0.5.0: --event');
  });

  it('prints usage for unknown command', async () => {
    const { stdout, deps } = createDeps();
    await runCli(['wat'], deps).catch(error => expect((error as Error).message).toBe('EXIT:2'));
    expect(stdout.join('\n')).toContain('Usage: learning-loop-reporter');
  });

  it('formats today in Asia/Shanghai', () => {
    expect(getTodayInShanghai(new Date('2026-04-26T16:30:00.000Z'))).toBe('2026-04-27');
  });
});
