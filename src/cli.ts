// src/cli.ts — CLI entry point for learning-loop-reporter v0.2.0

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  renderReport,
  assembleRenderData,
  type ReflectionEvent,
  type AssembleOptions,
} from './render.js';
import { loadConfig, sendToAllChannels, archiveEvent } from './send.js';

const USAGE = `Usage: learning-loop-reporter <command> [options]

Commands:
  notify   --event <path>    Send notification for reflection event
  preview  --event <path>    Preview rendered message without sending
           --raw             Output raw assembled JSON instead of rendered text
  health                     Self-check (config, channels, dependencies)
`;

function getConfigPath(): string {
  return join(homedir(), '.openclaw', 'workspace', 'learn', 'reporter-config.json');
}

function getDefaultPaths(): { candidatesDir: string; dbPath: string } {
  const ws = join(homedir(), '.openclaw', 'workspace');
  return {
    candidatesDir: join(ws, 'learn', 'candidates'),
    dbPath: join(ws, 'learn', 'candidates.db'),
  };
}

function loadEvent(path: string): ReflectionEvent {
  if (!existsSync(path)) throw new Error(`Event file not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf-8')) as ReflectionEvent;
}

function buildAssembleOpts(event: ReflectionEvent): AssembleOptions {
  const paths = getDefaultPaths();
  return {
    event,
    candidatesDir: paths.candidatesDir,
    dbPath: paths.dbPath,
  };
}

function cmdNotify(eventPath: string): void {
  const event = loadEvent(eventPath);
  const message = renderReport(buildAssembleOpts(event));

  const configPath = getConfigPath();
  const config = loadConfig(configPath);

  const result = sendToAllChannels(config, message);
  if (result.errors.length > 0) {
    console.error(`⚠️ Some channels failed: ${result.errors.join('; ')}`);
  }
  if (result.sent > 0) {
    archiveEvent(eventPath);
    console.log(`✅ Sent to ${result.sent} channel(s), event archived.`);
  } else {
    console.error('❌ Failed to send to any channel.');
    process.exit(1);
  }
}

function cmdPreview(eventPath: string, raw: boolean): void {
  const event = loadEvent(eventPath);
  const opts = buildAssembleOpts(event);

  if (raw) {
    const data = assembleRenderData(opts);
    console.log(JSON.stringify(data, null, 2));
  } else {
    const message = renderReport(opts);
    console.log('--- Preview ---');
    console.log(message);
    console.log('--- End ---');
  }
}

async function cmdHealth(): Promise<void> {
  const configPath = getConfigPath();
  let ok = true;

  if (existsSync(configPath)) {
    console.log(`✅ Config: ${configPath}`);
    try {
      const config = loadConfig(configPath);
      console.log(`   Channels: ${config.channels.length}`);
      for (const ch of config.channels) {
        console.log(`   - ${ch.type}: ${ch.target}`);
      }
    } catch (e) {
      console.log(`❌ Config parse error: ${(e as Error).message}`);
      ok = false;
    }
  } else {
    console.log(`❌ Config not found: ${configPath}`);
    ok = false;
  }

  try {
    const { execSync } = await import('node:child_process');
    execSync('which openclaw', { stdio: 'pipe' });
    console.log('✅ openclaw CLI: available');
  } catch {
    console.log('❌ openclaw CLI: not found (required for feishu send)');
    ok = false;
  }

  try {
    const paths = getDefaultPaths();
    console.log(`✅ Candidates dir: ${existsSync(paths.candidatesDir) ? 'exists' : 'missing'}`);
    console.log(`✅ Candidates DB: ${existsSync(paths.dbPath) ? 'exists' : 'missing'}`);
  } catch {
    console.log('⚠️ Could not check candidate paths');
  }

  process.exit(ok ? 0 : 1);
}

// --- Main ---
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'notify': {
    const idx = args.indexOf('--event');
    if (idx === -1 || !args[idx + 1]) {
      console.error('Usage: learning-loop-reporter notify --event <path>');
      process.exit(2);
    }
    cmdNotify(args[idx + 1]!);
    break;
  }
  case 'preview': {
    const idx = args.indexOf('--event');
    if (idx === -1 || !args[idx + 1]) {
      console.error('Usage: learning-loop-reporter preview --event <path>');
      process.exit(2);
    }
    const raw = args.includes('--raw');
    cmdPreview(args[idx + 1]!, raw);
    break;
  }
  case 'health':
    cmdHealth();
    break;
  default:
    console.log(USAGE);
    process.exit(command ? 2 : 0);
}
