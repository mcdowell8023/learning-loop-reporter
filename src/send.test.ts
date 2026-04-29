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
    const spy = vi.spyOn(send, 'sendToFeishu').mockResolvedValue({ messageId: 'om_x' });
    const result = await send.sendToAllChannels({ channels: [{ type: 'feishu', target: 'ou_test' }] }, 'msg', undefined, send.sendToFeishu);
    expect(spy).toHaveBeenCalledWith('ou_test', 'msg', undefined);
    expect(result.success).toBe(true);
    expect(result.channels).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.messageId).toBe('om_x');
    expect(result.results[0]).toMatchObject({ channel: 'feishu', target: 'ou_test', success: true, messageId: 'om_x' });
  });

  it('sendToAllChannels falls back to messageId="unknown" when sender returns no id', async () => {
    vi.spyOn(send, 'sendToFeishu').mockResolvedValue({});
    const result = await send.sendToAllChannels({ channels: [{ type: 'feishu', target: 'ou_test' }] }, 'msg', undefined, send.sendToFeishu);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('unknown');
    expect(result.results[0]?.messageId).toBe('unknown');
  });

  it('sendToAllChannels reports unknown channel type', async () => {
    const spy = vi.spyOn(send, 'sendToFeishu').mockResolvedValue({ messageId: 'om_x' });
    const result = await send.sendToAllChannels({ channels: [{ type: 'slack', target: 'x' }] }, 'msg', undefined, send.sendToFeishu);
    expect(spy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Unknown channel type');
  });

  it('sendToAllChannels collects send failures', async () => {
    vi.spyOn(send, 'sendToFeishu').mockRejectedValue(new Error('boom'));
    const result = await send.sendToAllChannels({ channels: [{ type: 'feishu', target: 'ou_test' }] }, 'msg', undefined, send.sendToFeishu);
    expect(result.success).toBe(false);
    expect(result.channels).toBe(0);
    expect(result.errors).toEqual(['feishu/ou_test: boom']);
    expect(result.messageId).toBeUndefined();
  });

  it('sendToAllChannels supports partial success', async () => {
    const spy = vi.spyOn(send, 'sendToFeishu');
    spy.mockResolvedValueOnce({ messageId: 'om_first' });
    spy.mockRejectedValueOnce(new Error('second failed'));
    const result = await send.sendToAllChannels({
      channels: [
        { type: 'feishu', target: 'ou_ok' },
        { type: 'feishu', target: 'ou_bad' },
      ],
    }, 'msg', undefined, send.sendToFeishu);
    expect(result.success).toBe(true);
    expect(result.channels).toBe(1);
    expect(result.errors).toEqual(['feishu/ou_bad: second failed']);
    expect(result.messageId).toBe('om_first');
  });

  it('sendToAllChannels passes attachmentPath through to sender', async () => {
    const spy = vi.spyOn(send, 'sendToFeishu').mockResolvedValue({ messageId: 'om_x' });
    await send.sendToAllChannels(
      { channels: [{ type: 'feishu', target: 'ou_test' }] },
      'msg',
      '/path/to/report.md',
      send.sendToFeishu,
    );
    expect(spy).toHaveBeenCalledWith('ou_test', 'msg', '/path/to/report.md');
  });

  it('buildFeishuSendCommand omits --media when no attachment provided', () => {
    const cmd = send.buildFeishuSendCommand('ou_test', 'hello');
    expect(cmd).toContain('--channel feishu');
    expect(cmd).toContain("--target 'ou_test'");
    expect(cmd).toContain("-m 'hello'");
    expect(cmd).not.toContain('--media');
  });

  it('buildFeishuSendCommand includes --media when attachment provided', () => {
    const cmd = send.buildFeishuSendCommand('ou_test', 'hello', '/tmp/report.md');
    expect(cmd).toContain("--media '/tmp/report.md'");
    expect(cmd).toContain("-m 'hello'");
  });

  it('buildFeishuSendCommand escapes single quotes in inputs', () => {
    const cmd = send.buildFeishuSendCommand("ou'x", "he'llo", "/tmp/it's.md");
    // 单引号转义为 '\\'' 序列（source 里写 '\\''）
    expect(cmd).toContain("'\\''");
    expect(cmd).toContain('--media');
  });

  it('parseMessageIdFromStdout parses human-readable text', () => {
    expect(send.parseMessageIdFromStdout('Message ID: om_abc123\n')).toBe('om_abc123');
    expect(send.parseMessageIdFromStdout('  message_id: om_xyz\n')).toBe('om_xyz');
    expect(send.parseMessageIdFromStdout('  message-id = om_dash\n')).toBe('om_dash');
  });

  it('parseMessageIdFromStdout parses JSON output', () => {
    expect(send.parseMessageIdFromStdout('{"message_id":"om_json1"}')).toBe('om_json1');
    expect(send.parseMessageIdFromStdout('{"data":{"message_id":"om_nested"}}')).toBe('om_nested');
    expect(send.parseMessageIdFromStdout('{"messageId":"om_camel"}')).toBe('om_camel');
  });

  it('parseMessageIdFromStdout falls back to om_ token regex', () => {
    expect(send.parseMessageIdFromStdout('something om_fallback123 done')).toBe('om_fallback123');
  });

  it('parseMessageIdFromStdout returns undefined for empty / unparseable', () => {
    expect(send.parseMessageIdFromStdout('')).toBeUndefined();
    expect(send.parseMessageIdFromStdout('no id here')).toBeUndefined();
  });
});
