import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleReportData, renderReport, type AssembleOptions, type ReflectionEvent } from './render.js';
import { archiveEvent, loadConfig, sendToAllChannels } from './send.js';

const USAGE = `Usage: learning-loop-reporter <command> [options]

Commands:
  notify   --event <path>          Send notification for reflection event
  preview  --event <path>          Preview rendered message without sending
           --fixture <name>        Preview built-in fixture from fixtures/
           --raw                   Output raw assembled JSON instead of rendered text
  health                           Self-check (config, channels, dependencies)
`;

export interface CliDeps {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  exit: (code: number) => never;
  loadConfig: typeof loadConfig;
  sendToAllChannels: typeof sendToAllChannels;
  archiveEvent: typeof archiveEvent;
  existsSync: typeof existsSync;
}

const defaultDeps: CliDeps = {
  stdout: text => process.stdout.write(`${text}\n`),
  stderr: text => process.stderr.write(`${text}\n`),
  exit: code => process.exit(code),
  loadConfig,
  sendToAllChannels,
  archiveEvent,
  existsSync,
};

function getProjectDir(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function getConfigPath(): string {
  return join(homedir(), '.openclaw', 'workspace', 'learn', 'reporter-config.json');
}

function getWorkspaceDir(): string {
  return join(homedir(), '.openclaw', 'workspace');
}

function getDefaultPaths(): { workspaceDir: string; candidatesDir: string } {
  const workspaceDir = getWorkspaceDir();
  return { workspaceDir, candidatesDir: join(workspaceDir, 'learn', 'candidates') };
}

function loadJsonFile(path: string): ReflectionEvent {
  return JSON.parse(readFileSync(path, 'utf8')) as ReflectionEvent;
}

function loadFixture(name: string): ReflectionEvent {
  const path = join(getProjectDir(), 'fixtures', `${name}.json`);
  if (!existsSync(path)) throw new Error(`Fixture not found: ${name}`);
  return loadJsonFile(path);
}

function buildAssembleOpts(event: ReflectionEvent): AssembleOptions {
  return {
    event,
    workspaceDir: event.workspace || getWorkspaceDir(),
  };
}

function getOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireEventOrFixture(args: string[]): ReflectionEvent {
  const eventPath = getOption(args, '--event');
  const fixtureName = getOption(args, '--fixture');
  if (eventPath) return loadJsonFile(eventPath);
  if (fixtureName) return loadFixture(fixtureName);
  throw new Error('Missing --event <path> or --fixture <name>');
}

function cmdNotify(args: string[], deps: CliDeps): void {
  const eventPath = getOption(args, '--event');
  if (!eventPath) throw new Error('Usage: learning-loop-reporter notify --event <path>');
  if (!deps.existsSync(eventPath)) throw new Error(`Event file not found: ${eventPath}`);

  const event = loadJsonFile(eventPath);
  const message = renderReport(buildAssembleOpts(event));
  const result = deps.sendToAllChannels(deps.loadConfig(getConfigPath()), message);

  if (result.sent > 0) {
    deps.archiveEvent(eventPath);
    deps.stdout(`✅ Sent to ${result.sent} channel(s), event archived.`);
    if (result.errors.length > 0) deps.stderr(`⚠️ Some channels failed: ${result.errors.join('; ')}`);
    return;
  }

  throw new Error(result.errors[0] ?? 'Failed to send to any channel.');
}

function cmdPreview(args: string[], deps: CliDeps): void {
  const raw = args.includes('--raw');
  const event = requireEventOrFixture(args);
  if (raw) {
    deps.stdout(JSON.stringify(assembleReportData(buildAssembleOpts(event)), null, 2));
    return;
  }
  deps.stdout(renderReport(buildAssembleOpts(event)).trimEnd());
}

async function cmdHealth(deps: CliDeps): Promise<void> {
  let ok = true;
  const configPath = getConfigPath();

  if (deps.existsSync(configPath)) {
    deps.stdout(`✅ Config: ${configPath}`);
    const config = deps.loadConfig(configPath);
    deps.stdout(`   Channels: ${config.channels.length}`);
  } else {
    deps.stdout(`❌ Config not found: ${configPath}`);
    ok = false;
  }

  const paths = getDefaultPaths();
  deps.stdout(`✅ Candidates dir: ${deps.existsSync(paths.candidatesDir) ? 'exists' : 'missing'}`);
  if (!ok) deps.exit(1);
}

export async function runCli(argv: string[], deps: Partial<CliDeps> = {}): Promise<void> {
  const merged = { ...defaultDeps, ...deps } as CliDeps;
  const [command, ...args] = argv;

  try {
    switch (command) {
      case 'notify':
        cmdNotify(args, merged);
        return;
      case 'preview':
        cmdPreview(args, merged);
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

export { USAGE, getConfigPath, getDefaultPaths, loadFixture, buildAssembleOpts, basename };
