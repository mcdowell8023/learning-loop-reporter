import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as send from './send.js';

describe('send module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loadConfig throws on missing file', () => {
    expect(() => send.loadConfig('/nonexistent/config.json')).toThrow('not found');
  });

  it('loadConfig parses valid config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'send-test-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ channels: [{ type: 'feishu', target: 'ou_test' }] }));
    expect(send.loadConfig(configPath).channels[0]?.target).toBe('ou_test');
  });

  it('sendToAllChannels sends feishu channel via mocked sendToFeishu', async () => {
    const spy = vi.spyOn(send, 'sendToFeishu').mockResolvedValue();
    const result = await send.sendToAllChannels({ channels: [{ type: 'feishu', target: 'ou_test' }] }, 'msg', send.sendToFeishu);
    expect(spy).toHaveBeenCalledWith('ou_test', 'msg');
    expect(result).toEqual({ success: true, channels: 1, errors: [] });
  });

  it('sendToAllChannels reports unknown channel type', async () => {
    const spy = vi.spyOn(send, 'sendToFeishu').mockResolvedValue();
    const result = await send.sendToAllChannels({ channels: [{ type: 'slack', target: 'x' }] }, 'msg', send.sendToFeishu);
    expect(spy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Unknown channel type');
  });

  it('sendToAllChannels collects send failures', async () => {
    vi.spyOn(send, 'sendToFeishu').mockRejectedValue(new Error('boom'));
    const result = await send.sendToAllChannels({ channels: [{ type: 'feishu', target: 'ou_test' }] }, 'msg', send.sendToFeishu);
    expect(result).toEqual({ success: false, channels: 0, errors: ['feishu/ou_test: boom'] });
  });

  it('sendToAllChannels supports partial success', async () => {
    const spy = vi.spyOn(send, 'sendToFeishu');
    spy.mockResolvedValueOnce();
    spy.mockRejectedValueOnce(new Error('second failed'));
    const result = await send.sendToAllChannels({
      channels: [
        { type: 'feishu', target: 'ou_ok' },
        { type: 'feishu', target: 'ou_bad' },
      ],
    }, 'msg', send.sendToFeishu);
    expect(result.success).toBe(true);
    expect(result.channels).toBe(1);
    expect(result.errors).toEqual(['feishu/ou_bad: second failed']);
  });
});
