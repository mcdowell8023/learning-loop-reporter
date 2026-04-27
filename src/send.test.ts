// src/send.test.ts — Tests for send module (all mocked, no real sends)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, sendToAllChannels, archiveEvent } from './send.js';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  it('throws on missing file', () => {
    expect(() => loadConfig('/nonexistent/config.json')).toThrow('not found');
  });

  it('parses valid config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'send-test-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ channels: [{ type: 'feishu', target: 'ou_test' }] }));
    const config = loadConfig(configPath);
    expect(config.channels).toHaveLength(1);
    expect(config.channels[0]!.type).toBe('feishu');
  });
});

describe('sendToAllChannels', () => {
  it('reports unknown channel type as error', () => {
    const result = sendToAllChannels({ channels: [{ type: 'slack', target: 'xxx' }] }, 'msg');
    expect(result.sent).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Unknown channel');
  });
});

describe('archiveEvent', () => {
  it('moves file to processed/', () => {
    const dir = mkdtempSync(join(tmpdir(), 'archive-test-'));
    const eventPath = join(dir, 'reflection-completed.json');
    writeFileSync(eventPath, '{}');
    archiveEvent(eventPath);
    expect(existsSync(eventPath)).toBe(false);
    const processed = join(dir, 'processed');
    expect(existsSync(processed)).toBe(true);
  });
});
