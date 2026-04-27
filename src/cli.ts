// src/cli.ts — CLI entry point for learning-loop-reporter

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { renderTemplate, loadDefaultTemplate, type ReflectionEvent } from './render.js';
import { loadConfig, sendToAllChannels, archiveEvent } from './send.js';

const USAGE = `Usage: learning-loop-reporter <command> [options]

Commands:
  notify   --event <path>    Send notification for reflection event
  preview  --event <path>    Preview rendered message without sending
  health                     Self-check (config, channels, dependencies)
`;

function getConfigPath(): string {
  return join(homedir(), '.openclaw', 'workspace', 'learn', 'reporter-config.json');
}

function loadEvent(path: string): ReflectionEvent {
  if (!existsSync(path)) throw new Error(`Event file not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf-8')) as ReflectionEvent;
}

function cmdNotify(eventPath: string): void {
  const event = loadEvent(eventPath);
  const template = loadDefaultTemplate();
  const message = renderTemplate(template, event);

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

function cmdPreview(eventPath: string): void {
  const event = loadEvent(eventPath);
  const template = loadDefaultTemplate();
  const message = renderTemplate(template, event);
  console.log('--- Preview ---');
  console.log(message);
  console.log('--- End ---');
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
    loadDefaultTemplate();
    console.log('✅ Template: loaded');
  } catch {
    console.log('❌ Template: not found');
    ok = false;
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
    cmdPreview(args[idx + 1]!);
    break;
  }
  case 'health':
    cmdHealth();
    break;
  default:
    console.log(USAGE);
    process.exit(command ? 2 : 0);
}
