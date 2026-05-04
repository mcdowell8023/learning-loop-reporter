import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export interface ChannelConfig {
  type: string;
  target: string;
}

export interface ReporterConfig {
  channels: ChannelConfig[];
}

export interface ChannelSendResult {
  channel: string;
  target: string;
  success: boolean;
  /** 从 openclaw message send stdout 解析出的 messageId；解析失败为 "unknown"。 */
  messageId?: string;
  error?: string;
}

export interface SendResult {
  success: boolean;
  channels: number;
  errors: string[];
  /** 首个成功通道的 messageId（供 marker 写入）。 */
  messageId?: string;
  /** 每个通道的明细。 */
  results: ChannelSendResult[];
}

export function loadConfig(configPath: string): ReporterConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Reporter config not found: ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf-8')) as ReporterConfig;
}

export function buildFeishuSendCommand(
  target: string,
  message: string,
  attachmentPath?: string,
): string {
  const escapedMsg = message.replace(/'/g, `'\\''`);
  let cmd = `openclaw message send --channel feishu --target '${target}'`;
  if (attachmentPath) {
    const escapedPath = attachmentPath.replace(/'/g, `'\\''`);
    cmd += ` --media '${escapedPath}'`;
  }
  cmd += ` -m '${escapedMsg}'`;
  return cmd;
}

/**
 * 从 `openclaw message send` stdout 中提取 messageId。
 * 兼容两种常见输出：
 *   1) 纯文本："Message ID: om_xxx" / "message_id: om_xxx"
 *   2) JSON：{"message_id":"om_xxx"} 或 {"data":{"message_id":"om_xxx"}}
 * 解析失败返回 undefined，调用方需回退为 "unknown"。
 */
export function parseMessageIdFromStdout(stdout: string): string | undefined {
  if (!stdout) return undefined;

  // 1) 人读文本："Message ID: om_xxx" / "message_id: om_xxx"
  const textMatch = stdout.match(/(?:message[ _-]?id|Message ID)\s*[:=]\s*([A-Za-z0-9_\-]+)/);
  if (textMatch && textMatch[1]) return textMatch[1];

  // 2) JSON 嵌入：message_id 字段能在任意层级
  try {
    // 尝试整个 stdout 的 JSON
    const trimmed = stdout.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      const found = findMessageId(parsed);
      if (found) return found;
    }
  } catch {
    /* fall through */
  }

  // 3) 充底 regex：在 stdout 任何位置上护以 "om_" / "msg_" 开头的 token
  const fallback = stdout.match(/\b(om_[A-Za-z0-9]+|msg_[A-Za-z0-9]+)\b/);
  if (fallback && fallback[1]) return fallback[1];

  return undefined;
}

function findMessageId(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  for (const key of ['message_id', 'messageId', 'msg_id', 'msgId']) {
    const v = o[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  for (const v of Object.values(o)) {
    const found = findMessageId(v);
    if (found) return found;
  }
  return undefined;
}

function isMockTarget(target: string): boolean {
  return target.startsWith('mock://');
}

function shouldDryRunSend(): boolean {
  if (process.env.ALLOW_REAL_SEND === '1') return false;
  if (process.env.DELIVERY_DRY_RUN === '1') return true;
  if (process.env.OPENCLAW_TEST_MODE === '1') return true;
  return false;
}

function syntheticMessageId(target: string, message: string): string {
  return `dryrun_${createHash('sha256').update(`${target}\n${message}`, 'utf8').digest('hex').slice(0, 12)}`;
}

function isExplicitRealSendAllowed(): boolean {
  return process.env.ALLOW_REAL_SEND === '1';
}

export async function sendToFeishu(
  target: string,
  message: string,
  attachmentPath?: string,
): Promise<{ messageId?: string }> {
  if (isMockTarget(target) || shouldDryRunSend()) {
    return { messageId: syntheticMessageId(target, message) };
  }

  if (!isExplicitRealSendAllowed() && (process.env.NODE_ENV === 'test' || process.env.CI === '1')) {
    return { messageId: syntheticMessageId(target, message) };
  }

  const stdout = execSync(buildFeishuSendCommand(target, message, attachmentPath), {
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString('utf-8');
  return { messageId: parseMessageIdFromStdout(stdout) };
}

export async function sendToAllChannels(
  config: ReporterConfig,
  message: string,
  attachmentPath?: string,
  sender: typeof sendToFeishu = sendToFeishu,
): Promise<SendResult> {
  const dryRun = shouldDryRunSend();
  let channels = 0;
  const errors: string[] = [];
  const results: ChannelSendResult[] = [];
  let firstMessageId: string | undefined;

  for (const channel of config.channels) {
    try {
      if (channel.type !== 'feishu') {
        const errMsg = `Unknown channel type: ${channel.type}`;
        errors.push(errMsg);
        results.push({ channel: channel.type, target: channel.target, success: false, error: errMsg });
        continue;
      }
      const sendRet = await sender(channel.target, message, attachmentPath);
      const messageId = sendRet?.messageId ?? 'unknown';
      if (firstMessageId === undefined) firstMessageId = messageId;
      results.push({
        channel: channel.type,
        target: channel.target,
        success: true,
        messageId,
      });
      channels++;
    } catch (error) {
      const errMsg = `${channel.type}/${channel.target}: ${(error as Error).message}`;
      errors.push(errMsg);
      results.push({
        channel: channel.type,
        target: channel.target,
        success: false,
        error: errMsg,
      });
    }
  }

  return {
    success: channels > 0,
    channels,
    errors,
    messageId: firstMessageId,
    results,
  };
}
