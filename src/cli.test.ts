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

function createDeps(): { stdout: string[]; stderr: string[]; sendSpy: unknown; deps: Partial<CliDeps>; markerCalls: any[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const sendSpy = vi.spyOn(send, 'sendToFeishu').mockResolvedValue({ messageId: 'om_test' });
  const markerCalls: any[] = [];

  return {
    stdout,
    stderr,
    sendSpy,
    markerCalls,
    deps: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
      exit: ((code: number) => { throw new Error(`EXIT:${code}`); }) as never,
      existsSync: vi.fn((path: unknown) => String(path).includes('reporter-config.json')) as unknown as CliDeps['existsSync'],
      loadConfig: vi.fn(() => ({ channels: [{ type: 'feishu', target: 'ou_test' }] })),
      sendToAllChannels: vi.fn(async () => ({
        success: true,
        channels: 1,
        errors: [],
        messageId: 'om_test',
        results: [{ channel: 'feishu', target: 'ou_test', success: true, messageId: 'om_test' }],
      })) as unknown as CliDeps['sendToAllChannels'],
      loadDailyReport: vi.fn(() => sampleReport) as unknown as CliDeps['loadDailyReport'],
      loadDailyReportFromPath: vi.fn(() => sampleReport) as unknown as CliDeps['loadDailyReportFromPath'],
      loadLatestDailyReport: vi.fn(() => sampleReport) as unknown as CliDeps['loadLatestDailyReport'],
      writeDeliveryMarker: vi.fn((date: string, marker: any) => {
        markerCalls.push({ date, marker });
        return `/tmp/.delivered/${date}.json`;
      }) as unknown as CliDeps['writeDeliveryMarker'],
      countRecentMarkers: vi.fn(() => ({ total: 7, valid: 5, missing: ['2026-04-22', '2026-04-23'] })) as unknown as CliDeps['countRecentMarkers'],
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
    expect(stdout.join('\n')).toContain('投递验证通过 messageId=om_test');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('notify writes delivery marker on success', async () => {
    const { deps, markerCalls } = createDeps();
    await runCli(['notify', '--date', '2026-04-27'], deps).catch(() => undefined);
    expect(deps.writeDeliveryMarker).toHaveBeenCalledOnce();
    expect(markerCalls).toHaveLength(1);
    const { date, marker } = markerCalls[0];
    expect(date).toBe('2026-04-27');
    expect(marker.messageId).toBe('om_test');
    expect(marker.channel).toBe('feishu');
    expect(marker.target).toBe('ou_test');
    expect(marker.report_filepath).toBe('/tmp/2026-04-27-daily.md');
    expect(marker.message_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(marker.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('notify failure: stderr emits parseable JSON and no marker written', async () => {
    const { stderr, deps } = createDeps();
    deps.sendToAllChannels = vi.fn(async () => ({
      success: false,
      channels: 0,
      errors: ['feishu/ou_test: boom'],
      messageId: undefined,
      results: [{ channel: 'feishu', target: 'ou_test', success: false, error: 'boom' }],
    })) as unknown as CliDeps['sendToAllChannels'];

    await runCli(['notify', '--date', '2026-04-27'], deps).catch(() => undefined);
    expect(deps.writeDeliveryMarker).not.toHaveBeenCalled();
    const errLine = stderr.find(s => s.startsWith('{'));
    expect(errLine).toBeDefined();
    const parsed = JSON.parse(errLine!);
    expect(parsed.reason).toBe('send_failed');
    expect(parsed.code).toBe('DELIVERY_FAILED');
    expect(parsed.errors).toContain('feishu/ou_test: boom');
  });

  it('notify falls back to messageId="unknown" when sender result has no id', async () => {
    const { deps, markerCalls } = createDeps();
    deps.sendToAllChannels = vi.fn(async () => ({
      success: true,
      channels: 1,
      errors: [],
      messageId: 'unknown',
      results: [{ channel: 'feishu', target: 'ou_test', success: true, messageId: 'unknown' }],
    })) as unknown as CliDeps['sendToAllChannels'];

    await runCli(['notify', '--date', '2026-04-27'], deps).catch(() => undefined);
    expect(markerCalls[0].marker.messageId).toBe('unknown');
  });

  it('health reports latest report and config and marker stats', async () => {
    const { stdout, deps } = createDeps();
    await runCli(['health'], deps).catch(() => undefined);
    const text = stdout.join('\n');
    expect(text).toContain('✅ Config:');
    expect(text).toContain('✅ Latest report:');
    expect(text).toContain('Delivery markers (last 7d): 5/7 valid');
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
