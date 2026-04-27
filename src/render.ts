// src/render.ts — Template renderer for reflection events

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ReflectionEvent {
  event: string;
  version: string;
  timestamp: string;
  runtime: string;
  workspace: string;
  reflection: {
    from: string | null;
    to: string | null;
    watermark_before: string | null;
    watermark_after: string | null;
    duration_ms: number;
    events_collected: number;
    candidates_generated: number;
    candidates_dropped: number;
    reasons_triggered: string[];
  };
  candidates_summary: {
    pending: number;
    reviewing: number;
    shadow: number;
    graduated: number;
    high_confidence: Array<{ id: string; domain: string; confidence: number }>;
  };
  errors: string[];
}

export function renderTemplate(templateStr: string, event: ReflectionEvent): string {
  const date = event.timestamp.split('T')[0] ?? event.timestamp;
  const durationSeconds = (event.reflection.duration_ms / 1000).toFixed(1);

  let output = templateStr;

  // Simple {{ field }} replacements
  const replacements: Record<string, string> = {
    date,
    'reflection.events_collected': String(event.reflection.events_collected),
    'reflection.candidates_generated': String(event.reflection.candidates_generated),
    'reflection.candidates_dropped': String(event.reflection.candidates_dropped),
    'reflection.watermark_before': event.reflection.watermark_before ?? 'none',
    'reflection.watermark_after': event.reflection.watermark_after ?? 'none',
    duration_seconds: durationSeconds,
    'candidates_summary.pending': String(event.candidates_summary.pending),
    'candidates_summary.reviewing': String(event.candidates_summary.reviewing),
    'candidates_summary.shadow': String(event.candidates_summary.shadow),
    'candidates_summary.graduated': String(event.candidates_summary.graduated),
  };

  for (const [key, value] of Object.entries(replacements)) {
    output = output.replace(new RegExp(`\\{\\{\\s*${key.replace(/\./g, '\\.')}\\s*\\}\\}`, 'g'), value);
  }

  // {{#high_confidence}} ... {{/high_confidence}} block
  const highConfBlock = /\{\{#high_confidence\}\}([\s\S]*?)\{\{\/high_confidence\}\}/;
  const noHighConfBlock = /\{\{\^high_confidence\}\}([\s\S]*?)\{\{\/high_confidence\}\}/;

  if (event.candidates_summary.high_confidence.length > 0) {
    const match = output.match(highConfBlock);
    if (match) {
      const itemTemplate = match[1]!;
      const items = event.candidates_summary.high_confidence
        .map(c => itemTemplate
          .replace(/\{\{\s*id\s*\}\}/g, c.id)
          .replace(/\{\{\s*domain\s*\}\}/g, c.domain)
          .replace(/\{\{\s*confidence\s*\}\}/g, String(c.confidence))
        ).join('');
      output = output.replace(highConfBlock, items);
    }
    output = output.replace(noHighConfBlock, '');
  } else {
    output = output.replace(highConfBlock, '');
    const noMatch = output.match(noHighConfBlock);
    if (noMatch) {
      output = output.replace(noHighConfBlock, noMatch[1]!);
    }
  }

  // {{#errors_present}} ... {{/errors_present}} block
  const errorsBlock = /\{\{#errors_present\}\}([\s\S]*?)\{\{\/errors_present\}\}/;
  if (event.errors && event.errors.length > 0) {
    const match = output.match(errorsBlock);
    if (match) {
      let content = match[1]!;
      const errLoop = /\{\{#errors\}\}([\s\S]*?)\{\{\/errors\}\}/;
      const errMatch = content.match(errLoop);
      if (errMatch) {
        const errItems = event.errors
          .map(e => errMatch[1]!.replace(/\{\{\s*\.\s*\}\}/g, e))
          .join('');
        content = content.replace(errLoop, errItems);
      }
      output = output.replace(errorsBlock, content);
    }
  } else {
    output = output.replace(errorsBlock, '');
  }

  return output.trim() + '\n';
}

export function loadDefaultTemplate(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const tmplPath = resolve(__dirname, '..', 'templates', 'daily-report.tmpl');
  return readFileSync(tmplPath, 'utf-8');
}
