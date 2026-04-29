import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeDeliveryMarker,
  readDeliveryMarker,
  getMarkerPath,
  getMarkerDir,
  hashMessage,
  countRecentMarkers,
  type DeliveryMarker,
} from './delivery-marker.js';

const sampleMarker = (): DeliveryMarker => ({
  messageId: 'om_abc123',
  channel: 'feishu',
  target: 'ou_test',
  ts: '2026-04-29T09:50:00+08:00',
  report_filepath: '/tmp/2026-04-29-daily.md',
  message_hash: hashMessage('hello world'),
});

describe('delivery-marker', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'marker-test-'));
  });

  afterEach(() => {
    if (workspaceDir && existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('getMarkerPath builds expected path', () => {
    const p = getMarkerPath('2026-04-29', workspaceDir);
    expect(p).toBe(join(workspaceDir, 'learn', 'reports', '.delivered', '2026-04-29.json'));
  });

  it('writeDeliveryMarker writes valid JSON atomically', () => {
    const path = writeDeliveryMarker('2026-04-29', sampleMarker(), workspaceDir);
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.messageId).toBe('om_abc123');
    expect(parsed.channel).toBe('feishu');
    expect(parsed.message_hash).toMatch(/^[a-f0-9]{64}$/);
    // 末尾应有换行符
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('readDeliveryMarker returns null when file missing', () => {
    expect(readDeliveryMarker('2026-04-29', workspaceDir)).toBeNull();
  });

  it('readDeliveryMarker returns null on corrupt JSON', () => {
    const dir = getMarkerDir(workspaceDir);
    fs.mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-04-29.json'), '{not json');
    expect(readDeliveryMarker('2026-04-29', workspaceDir)).toBeNull();
  });

  it('roundtrip: write then read returns identical marker', () => {
    const m = sampleMarker();
    writeDeliveryMarker('2026-04-29', m, workspaceDir);
    const got = readDeliveryMarker('2026-04-29', workspaceDir);
    expect(got).toEqual(m);
  });

  it('repeated date overwrites previous marker', () => {
    writeDeliveryMarker('2026-04-29', sampleMarker(), workspaceDir);
    const second: DeliveryMarker = { ...sampleMarker(), messageId: 'om_second' };
    writeDeliveryMarker('2026-04-29', second, workspaceDir);
    const got = readDeliveryMarker('2026-04-29', workspaceDir);
    expect(got?.messageId).toBe('om_second');
  });

  it('crash before rename: target file does not exist, no half-written file', () => {
    const failingRename = (() => {
      throw new Error('simulated crash before rename');
    }) as unknown as typeof fs.renameSync;

    expect(() =>
      writeDeliveryMarker('2026-04-29', sampleMarker(), workspaceDir, { renameSync: failingRename }),
    ).toThrow('simulated crash before rename');

    const finalPath = getMarkerPath('2026-04-29', workspaceDir);
    expect(existsSync(finalPath)).toBe(false);

    const dir = getMarkerDir(workspaceDir);
    if (existsSync(dir)) {
      const leftover = readdirSync(dir).filter(f => f.includes('.tmp.'));
      expect(leftover).toEqual([]);
    }
  });

  it('crash before rename does not corrupt existing marker', () => {
    writeDeliveryMarker('2026-04-29', sampleMarker(), workspaceDir);
    const before = readFileSync(getMarkerPath('2026-04-29', workspaceDir), 'utf-8');

    const failingRename = (() => {
      throw new Error('simulated crash');
    }) as unknown as typeof fs.renameSync;
    const next: DeliveryMarker = { ...sampleMarker(), messageId: 'om_should_fail' };
    expect(() =>
      writeDeliveryMarker('2026-04-29', next, workspaceDir, { renameSync: failingRename }),
    ).toThrow('simulated crash');

    // 原有 marker 内容保持不变（rename 是原子，目标未被替换）
    const after = readFileSync(getMarkerPath('2026-04-29', workspaceDir), 'utf-8');
    expect(after).toBe(before);
  });

  it('hashMessage produces stable sha256 hex', () => {
    expect(hashMessage('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('countRecentMarkers reports valid/missing for last N days', () => {
    // 写入今天和昨天的 marker
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const now = new Date();
    const today = formatter.format(now);
    const yesterday = formatter.format(new Date(now.getTime() - 86400000));

    writeDeliveryMarker(today, sampleMarker(), workspaceDir);
    writeDeliveryMarker(yesterday, sampleMarker(), workspaceDir);

    const result = countRecentMarkers(3, now, workspaceDir);
    expect(result.total).toBe(3);
    expect(result.valid).toBe(2);
    expect(result.missing.length).toBe(1);
  });

  it('countRecentMarkers treats empty messageId as missing', () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = formatter.format(new Date());
    writeDeliveryMarker(today, { ...sampleMarker(), messageId: '' }, workspaceDir);
    const result = countRecentMarkers(1, new Date(), workspaceDir);
    expect(result.valid).toBe(0);
    expect(result.missing).toContain(today);
  });
});
