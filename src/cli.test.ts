import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runCli } from './cli.js';

function createDeps() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    deps: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
      loadConfig: vi.fn(() => ({ channels: [{ type: 'feishu', target: 'ou_test' }] })),
      sendToAllChannels: vi.fn(() => ({ sent: 1, errors: [] })),
      archiveEvent: vi.fn(),
      existsSync: vi.fn(() => true),
      exit: ((code: number) => { throw new Error(`EXIT:${code}`); }) as never,
    },
  };
}

describe('cli', () => {
  it('preview --fixture rich renders new candidate section', async () => {
    const { stdout, deps } = createDeps();
    await runCli(['preview', '--fixture', 'rich'], deps).catch(() => undefined);
    expect(stdout.join('\n')).toContain('═══ 🆕 新候选 ═══');
  });

  it('preview --fixture rich --raw outputs assembled json', async () => {
    const { stdout, deps } = createDeps();
    await runCli(['preview', '--fixture', 'rich', '--raw'], deps).catch(() => undefined);
    expect(stdout.join('\n')).toContain('"eventsCollected": 22');
  });

  it('notify calls sender and archive', async () => {
    const { deps } = createDeps();
    const dir = mkdtempSync(join(tmpdir(), 'reporter-cli-'));
    const eventPath = join(dir, 'event.json');
    writeFileSync(eventPath, JSON.stringify({
      event: 'reflection-completed',
      version: '1.1',
      timestamp: '2026-04-27T06:00:00.000Z',
      runtime: 'openclaw',
      workspace: '/tmp',
      reflection: { from: null, to: null, watermark_before: null, watermark_after: null, duration_ms: 1000, events_collected: 1, candidates_generated: 0, candidates_dropped: 0, reasons_triggered: [] },
      candidates_summary: { pending: 0, reviewing: 0, shadow: 0, graduated: 0, high_confidence: [] },
      errors: [],
    }));
    await runCli(['notify', '--event', eventPath], deps).catch(() => undefined);
    expect(deps.sendToAllChannels).toHaveBeenCalledOnce();
    expect(deps.archiveEvent).toHaveBeenCalledWith(eventPath);
  });

  it('missing preview input exits with code 2', async () => {
    const { stderr, deps } = createDeps();
    await runCli(['preview'], deps).catch(error => expect((error as Error).message).toBe('EXIT:2'));
    expect(stderr.join('\n')).toContain('Missing --event <path> or --fixture <name>');
  });

  it('prints usage for unknown command', async () => {
    const { stdout, deps } = createDeps();
    await runCli(['wat'], deps).catch(error => expect((error as Error).message).toBe('EXIT:2'));
    expect(stdout.join('\n')).toContain('Usage: learning-loop-reporter');
  });
});
