/**
 * Shared safety + I/O helpers for the Vapi setup scripts.
 *
 * Everything destructive in this app routes through these helpers so that
 * the dry-run gate, name-contains-joola assertion, typed confirmation,
 * audit log, and env loading are all enforced in one place.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import dotenv from 'dotenv';

// -----------------------------------------------------------------------------
// Filesystem anchors
// -----------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
// src/ -> vapi-setup/ -> apps/ -> repo root
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
export const APP_ROOT = path.resolve(HERE, '..');
export const CONFIG_PKG_ROOT = path.resolve(
  REPO_ROOT,
  'packages',
  'vapi-assistant-config',
);
export const AUDIT_LOG_PATH = path.join(APP_ROOT, 'audit.log');

// -----------------------------------------------------------------------------
// Env loading
// -----------------------------------------------------------------------------

export interface Env {
  VAPI_API_KEY: string;
  VAPI_ASSISTANT_ID: string;
  VAPI_WEBHOOK_SECRET: string;
  PUBLIC_BACKEND_URL: string;
}

const REQUIRED_KEYS: ReadonlyArray<keyof Env> = [
  'VAPI_API_KEY',
  'VAPI_ASSISTANT_ID',
  'VAPI_WEBHOOK_SECRET',
  'PUBLIC_BACKEND_URL',
];

/**
 * Load .env.local from the repo root. Throws with a clear list of any missing
 * required keys. Never logs the actual secret values.
 */
export function loadEnv(): Env {
  dotenv.config({ path: path.join(REPO_ROOT, '.env.local') });

  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const v = process.env[key];
    if (v === undefined || v === '') {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars in .env.local: ${missing.join(', ')}`,
    );
  }

  return {
    VAPI_API_KEY: process.env['VAPI_API_KEY'] as string,
    VAPI_ASSISTANT_ID: process.env['VAPI_ASSISTANT_ID'] as string,
    VAPI_WEBHOOK_SECRET: process.env['VAPI_WEBHOOK_SECRET'] as string,
    PUBLIC_BACKEND_URL: process.env['PUBLIC_BACKEND_URL'] as string,
  };
}

// -----------------------------------------------------------------------------
// Name guard
// -----------------------------------------------------------------------------

/**
 * Returns true if the given assistant name contains "joola" (case-insensitive).
 * Used to guard destructive operations against accidentally targeting another
 * assistant in the same Vapi organization.
 */
export function nameContainsJoola(name: string | undefined | null): boolean {
  if (typeof name !== 'string') {
    return false;
  }
  return name.toLowerCase().includes('joola');
}

/**
 * Asserts the assistant name contains "joola". Throws a descriptive error if
 * not. Use this immediately after every GET /assistant call before any PATCH
 * or DELETE.
 */
export function assertNameContainsJoola(name: string | undefined | null): void {
  if (!nameContainsJoola(name)) {
    throw new Error(
      `Assistant name '${name ?? '<unknown>'}' does not contain 'joola' — ` +
        `refusing to proceed. Verify VAPI_ASSISTANT_ID in .env.local.`,
    );
  }
}

// -----------------------------------------------------------------------------
// Dry-run gate
// -----------------------------------------------------------------------------

/**
 * True unless `--apply` is present in process.argv. All destructive scripts
 * must check this and exit early if true.
 */
export function isDryRun(): boolean {
  return !process.argv.includes('--apply');
}

// -----------------------------------------------------------------------------
// Typed confirmation
// -----------------------------------------------------------------------------

/**
 * Prompts the operator on the terminal and only resolves if they type the
 * exact `expected` string. Throws otherwise. Trims whitespace.
 */
export async function requireConfirm(
  prompt: string,
  expected: string,
): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${prompt}\n> `)).trim();
    if (answer !== expected) {
      throw new Error(
        `Confirmation did not match. Expected literal '${expected}', got '${answer}'.`,
      );
    }
  } finally {
    rl.close();
  }
}

// -----------------------------------------------------------------------------
// Audit log
// -----------------------------------------------------------------------------

export interface AuditEntry {
  iso_ts: string;
  action: string;
  details: Record<string, unknown>;
}

/**
 * Append a single JSON line to apps/vapi-setup/audit.log.
 * Each line is a valid JSON object terminated by `\n`.
 */
export async function appendAudit(
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  const entry: AuditEntry = {
    iso_ts: new Date().toISOString(),
    action,
    details,
  };
  await fs.appendFile(AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

// -----------------------------------------------------------------------------
// Assistant config loader (with placeholder substitution)
// -----------------------------------------------------------------------------

export interface AssistantConfigInput {
  webhookUrl: string;
  webhookSecret: string;
}

/**
 * Read packages/vapi-assistant-config/assistant.json (the template),
 * read system-prompt.md, read every tools/*.json, and substitute the four
 * placeholders. Returns a plain object ready to POST to Vapi.
 *
 * Placeholders replaced:
 *   __SYSTEM_PROMPT__   -> contents of system-prompt.md (string)
 *   __TOOLS__           -> array of OpenAI function-call schemas
 *   __WEBHOOK_URL__     -> input.webhookUrl
 *   __WEBHOOK_SECRET__  -> input.webhookSecret
 */
export async function loadAssistantConfig(
  input: AssistantConfigInput,
): Promise<Record<string, unknown>> {
  const templatePath = path.join(CONFIG_PKG_ROOT, 'assistant.json');
  const systemPromptPath = path.join(CONFIG_PKG_ROOT, 'system-prompt.md');
  const toolsDir = path.join(CONFIG_PKG_ROOT, 'tools');

  const [templateRaw, systemPrompt, toolFiles] = await Promise.all([
    fs.readFile(templatePath, 'utf8'),
    fs.readFile(systemPromptPath, 'utf8'),
    fs.readdir(toolsDir),
  ]);

  const toolJsonFiles = toolFiles
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const tools: unknown[] = await Promise.all(
    toolJsonFiles.map(async (f) => {
      const raw = await fs.readFile(path.join(toolsDir, f), 'utf8');
      try {
        return JSON.parse(raw) as unknown;
      } catch (err) {
        throw new Error(
          `Failed to parse tool schema ${f}: ${(err as Error).message}`,
        );
      }
    }),
  );

  // Parse the template, then substitute the placeholder strings with real
  // values. We mutate the parsed object rather than string-replacing into
  // JSON, so we don't have to worry about escaping the markdown prompt.
  const template = JSON.parse(templateRaw) as Record<string, unknown>;

  const model = template['model'];
  if (model && typeof model === 'object') {
    const m = model as Record<string, unknown>;
    if (m['systemPrompt'] === '__SYSTEM_PROMPT__') {
      m['systemPrompt'] = systemPrompt;
    }
    if (m['tools'] === '__TOOLS__') {
      m['tools'] = tools;
    }
  }

  if (template['serverUrl'] === '__WEBHOOK_URL__') {
    template['serverUrl'] = input.webhookUrl;
  }
  if (template['serverUrlSecret'] === '__WEBHOOK_SECRET__') {
    template['serverUrlSecret'] = input.webhookSecret;
  }

  return template;
}
