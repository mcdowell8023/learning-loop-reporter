import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Delivery marker for self-learning-loop daily report投递闭环 (T-046).
 *
 * Marker 文件落盘在 `<workspace>/learn/reports/.delivered/<date>.json`，
 * 是 daily-reflect.sh / weekly-delivery-audit.sh 判定真实送达的唯一证据。
 *
 * 写入采用 tmp 文件 → fsyncSync → renameSync 三件套，保证崩溃时
 * 目标文件要么完整、要么不存在，绝不出现半写状态。
 */

export interface DeliveryMarker {
  /** 飞书等通道返回的真实 messageId；解析失败可置 "unknown"。 */
  messageId: string;
  /** 通道类型，例如 "feishu"。 */
  channel: string;
  /** 通道目标（飞书 open_id / chat_id 等）。 */
  target: string;
  /** ISO 8601 时间戳。 */
  ts: string;
  /** 报告原始 markdown 文件路径。 */
  report_filepath: string;
  /** 渲染后送达内容的 sha256 hex。 */
  message_hash: string;
}

export function getWorkspaceDir(): string {
  return join(homedir(), '.openclaw', 'workspace');
}

export function getMarkerDir(workspaceDir: string = getWorkspaceDir()): string {
  return join(workspaceDir, 'learn', 'reports', '.delivered');
}

export function getMarkerPath(date: string, workspaceDir: string = getWorkspaceDir()): string {
  return join(getMarkerDir(workspaceDir), `${date}.json`);
}

export function hashMessage(rendered: string): string {
  return createHash('sha256').update(rendered, 'utf-8').digest('hex');
}

/**
 * 原子写入 marker 文件。tmp → fsync → rename，异常时清理 tmp 不写正式文件。
 *
 * @throws 写入失败时抛出 Error；调用方应：
 *   1) 不写 marker；
 *   2) stderr 输出可解析 JSON（含 reason / code）；
 *   3) 进程以非 0 退出。
 */
/**
 * 测试钩子：允许单测注入 renameSync 来模拟崩溃。
 * ESM 下无法 spyOn node:fs 的命名导出，故走 DI。
 */
export interface WriteDeliveryMarkerHooks {
  renameSync?: typeof renameSync;
}

export function writeDeliveryMarker(
  date: string,
  marker: DeliveryMarker,
  workspaceDir: string = getWorkspaceDir(),
  hooks: WriteDeliveryMarkerHooks = {},
): string {
  const finalPath = getMarkerPath(date, workspaceDir);
  const dir = dirname(finalPath);
  mkdirSync(dir, { recursive: true });

  const tmpPath = `${finalPath}.tmp.${process.pid}.${Date.now()}`;
  const payload = `${JSON.stringify(marker, null, 2)}\n`;
  const doRename = hooks.renameSync ?? renameSync;

  let fd: number | null = null;
  try {
    fd = openSync(tmpPath, 'w', 0o644);
    writeSync(fd, payload);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;

    // Atomic replace：rename 在同文件系统内是原子操作。
    doRename(tmpPath, finalPath);

    // 尽力刷新目录元数据，确保 rename 持久化（部分平台允许 r 打开目录）。
    try {
      const dfd = openSync(dir, 'r');
      try {
        fsyncSync(dfd);
      } finally {
        closeSync(dfd);
      }
    } catch {
      // 平台不支持目录 fsync 时静默跳过——rename 本身已经原子。
    }

    return finalPath;
  } catch (err) {
    // 失败：清理 tmp（若存在），不留半写痕迹。
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
}

/**
 * 读取 marker。文件缺失或 JSON 损坏均返回 null（调用方据此判定未送达）。
 */
export function readDeliveryMarker(
  date: string,
  workspaceDir: string = getWorkspaceDir(),
): DeliveryMarker | null {
  const path = getMarkerPath(date, workspaceDir);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as DeliveryMarker;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.messageId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 列出 marker 目录下最近 N 天内已存在的 marker 数量（用于 health 子命令）。
 */
export function countRecentMarkers(
  days: number,
  now: Date = new Date(),
  workspaceDir: string = getWorkspaceDir(),
): { total: number; valid: number; missing: string[] } {
  const missing: string[] = [];
  let valid = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const date = formatter.format(d);
    total++;
    const marker = readDeliveryMarker(date, workspaceDir);
    if (marker && marker.messageId && marker.messageId !== '') {
      valid++;
    } else {
      missing.push(date);
    }
  }
  return { total, valid, missing };
}
