import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export interface ChannelConfig {
  type: string;
  target: string;
}

export interface ReporterConfig {
  channels: ChannelConfig[];
}

export interface SendResult {
  success: boolean;
  channels: number;
  errors: string[];
}

export function loadConfig(configPath: string): ReporterConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Reporter config not found: ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf-8')) as ReporterConfig;
}

export async function sendToFeishu(target: string, message: string): Promise<void> {
  const escaped = message.replace(/'/g, `'\\''`);
  execSync(`openclaw message send --channel feishu --target '${target}' -m '${escaped}'`, {
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function sendToAllChannels(
  config: ReporterConfig,
  message: string,
  sender: typeof sendToFeishu = sendToFeishu,
): Promise<SendResult> {
  let channels = 0;
  const errors: string[] = [];

  for (const channel of config.channels) {
    try {
      if (channel.type !== 'feishu') {
        errors.push(`Unknown channel type: ${channel.type}`);
        continue;
      }
      await sender(channel.target, message);
      channels++;
    } catch (error) {
      errors.push(`${channel.type}/${channel.target}: ${(error as Error).message}`);
    }
  }

  return {
    success: channels > 0,
    channels,
    errors,
  };
}
