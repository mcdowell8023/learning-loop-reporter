// src/send.ts — Feishu notification sender

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface ChannelConfig {
  type: string;
  target: string;
}

export interface ReporterConfig {
  channels: ChannelConfig[];
}

export function loadConfig(configPath: string): ReporterConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Reporter config not found: ${configPath}`);
  }
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as ReporterConfig;
}

export function sendFeishu(target: string, message: string): void {
  const escaped = message.replace(/'/g, "'\\''");
  execSync(`openclaw message send --channel feishu --target '${target}' -m '${escaped}'`, {
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function archiveEvent(eventFilePath: string): void {
  const dir = dirname(eventFilePath);
  const processedDir = join(dir, 'processed');
  mkdirSync(processedDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `reflection-completed-${ts}.json`;
  renameSync(eventFilePath, join(processedDir, archiveName));
}

export function sendToAllChannels(config: ReporterConfig, message: string): { sent: number; errors: string[] } {
  let sent = 0;
  const errors: string[] = [];
  for (const ch of config.channels) {
    try {
      if (ch.type === 'feishu') {
        sendFeishu(ch.target, message);
        sent++;
      } else {
        errors.push(`Unknown channel type: ${ch.type}`);
      }
    } catch (e) {
      errors.push(`${ch.type}/${ch.target}: ${(e as Error).message}`);
    }
  }
  return { sent, errors };
}
