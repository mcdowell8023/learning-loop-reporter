import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadDailyReport, loadDailyReportFromPath, loadLatestDailyReport, type DailyReport } from './loaders/daily-report-loader.js';
import { renderForFeishu } from './render.js';
import { loadConfig, sendToAllChannels } from './send.js';

const USAGE = `Usage: learning-loop-reporter <command> [options]

Commands:
  notify   [--date YYYY-MM-DD] [--report <path>]   Send rendered daily report
  preview  [--date YYYY-MM-DD] [--report <path>]   Print rendered message to stdout
  health                                         Self-check (config + reports)

Notes:
  - Default date is today in Asia/Shanghai.
  - --report has priority over --date.
  - Deprecated: --event, --fixture, --raw
`;

export interface CliDeps {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  exit: (code: number) => never;
  existsSync: typeof existsSync;
  loadConfig: typeof loadConfig;
  sendToAllChannels: typeof sendToAllChannels;
  loadDailyReport: typeof loadDailyReport;
  loadDailyReportFromPath: typeof loadDailyReportFromPath;
  loadLatestDailyReport: typeof loadLatestDailyReport;
  now: () => Date;
}

const defaultDeps: CliDeps = {
  stdout: text => process.stdout.write(`${text}\n`),
  stderr: text => process.stderr.write(`${text}\n`),
  exit: code => process.exit(code),
  existsSync,
  loadConfig,
  sendToAllChannels,
  loadDailyReport,
  loadDailyReportFromPath,
  loadLatestDailyReport,
  now: () => new Date(),
};

export function getWorkspaceDir(): string {
  return join(homedir(), '.openclaw', 'workspace');
}

export function getConfigPath(): string {
  return join(getWorkspaceDir(), 'learn', 'reporter-config.json');
}

function getOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasDeprecatedFlags(args: string[]): string[] {
  return ['--event', '--fixture', '--raw'].filter(flag => args.includes(flag));
}

export function getTodayInShanghai(now: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function loadRequestedReport(args: string[], deps: CliDeps): DailyReport {
  const reportPath = getOption(args, '--report');
  const date = getOption(args, '--date') ?? getTodayInShanghai(deps.now());
  const workspaceDir = getWorkspaceDir();

  if (reportPath) {
    const report = deps.loadDailyReportFromPath(reportPath);
    if (report) return report;
    throw new Error(`Report not found: ${reportPath}`);
  }

  const report = deps.loadDailyReport(workspaceDir, date);
  if (report) return report;

  const latest = deps.loadLatestDailyReport(workspaceDir);
  if (latest) {
    throw new Error(`Daily report not found for ${date}. Latest available: ${latest.meta.date} (${latest.filepath})`);
  }

  throw new Error(`Daily report not found for ${date}`);
}

async function cmdPreview(args: string[], deps: CliDeps): Promise<void> {
  const deprecated = hasDeprecatedFlags(args);
  if (deprecated.length > 0) {
    deps.stderr(`Deprecated flags removed in v0.5.0: ${deprecated.join(', ')}`);
    throw new Error('Use --date YYYY-MM-DD or --report <path> instead.');
  }

  const report = loadRequestedReport(args, deps);
  deps.stdout(renderForFeishu(report).trimEnd());
}

async function cmdNotify(args: string[], deps: CliDeps): Promise<void> {
  const deprecated = hasDeprecatedFlags(args);
  if (deprecated.length > 0) {
    deps.stderr(`Deprecated flags removed in v0.5.0: ${deprecated.join(', ')}`);
    throw new Error('Use --date YYYY-MM-DD or --report <path> instead.');
  }

  const report = loadRequestedReport(args, deps);
  const result = await deps.sendToAllChannels(deps.loadConfig(getConfigPath()), renderForFeishu(report));

  if (!result.success) {
    throw new Error(result.errors[0] ?? 'Failed to send to any channel.');
  }

  deps.stdout(`✅ Sent daily report to ${result.channels} channel(s): ${report.filepath}`);
  if (result.errors.length > 0) {
    deps.stderr(`⚠️ Some channels failed: ${result.errors.join('; ')}`);
  }
}

async function cmdHealth(deps: CliDeps): Promise<void> {
  let ok = true;
  const configPath = getConfigPath();
  const workspaceDir = getWorkspaceDir();

  if (deps.existsSync(configPath)) {
    const config = deps.loadConfig(configPath);
    deps.stdout(`✅ Config: ${configPath}`);
    deps.stdout(`   Channels: ${config.channels.length}`);
  } else {
    deps.stdout(`❌ Config not found: ${configPath}`);
    ok = false;
  }

  const latest = deps.loadLatestDailyReport(workspaceDir);
  if (latest) {
    deps.stdout(`✅ Latest report: ${latest.filepath}`);
  } else {
    deps.stdout(`❌ No daily reports found under ${join(workspaceDir, 'learn', 'reports')}`);
    ok = false;
  }

  if (!ok) deps.exit(1);
}

export async function runCli(argv: string[], deps: Partial<CliDeps> = {}): Promise<void> {
  const merged = { ...defaultDeps, ...deps } as CliDeps;
  const [command, ...args] = argv;

  try {
    switch (command) {
      case 'notify':
        await cmdNotify(args, merged);
        return;
      case 'preview':
        await cmdPreview(args, merged);
        return;
      case 'health':
        await cmdHealth(merged);
        return;
      default:
        merged.stdout(USAGE.trimEnd());
        merged.exit(command ? 2 : 0);
    }
  } catch (error) {
    merged.stderr((error as Error).message);
    merged.exit(2);
  }
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : '';
if (import.meta.url === invokedPath) {
  void runCli(process.argv.slice(2));
}

export { USAGE };
