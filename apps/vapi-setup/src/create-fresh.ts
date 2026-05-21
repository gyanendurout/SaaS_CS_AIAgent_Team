/**
 * vapi:create-fresh — one-shot script to create a brand-new JOOLA Vapi
 * assistant with full config (system prompt + 5 tools + real webhook URL).
 *
 * Use this when:
 *   - You don't have a pre-existing JOOLA assistant to recreate (the safety
 *     guard in recreate.ts refuses to act on assistants whose name does not
 *     contain "joola"), OR
 *   - You want to leave the existing assistant alone and start a new one.
 *
 * This script does NOT delete anything. It only CREATES.
 *
 * Usage:
 *   pnpm tsx src/create-fresh.ts            # dry run
 *   pnpm tsx src/create-fresh.ts --apply    # actually create
 */

import { loadAssistantConfig, appendAudit, isDryRun } from './safety.js';
import { VapiClient, VapiError } from './vapi-client.js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

async function main(): Promise<void> {
  dotenv.config({ path: path.join(REPO_ROOT, '.env.local') });

  const apiKey = process.env['VAPI_API_KEY'];
  const webhookUrl = process.env['PUBLIC_BACKEND_URL'];
  const webhookSecret = process.env['VAPI_WEBHOOK_SECRET'];

  if (!apiKey || !webhookUrl || !webhookSecret) {
    throw new Error(
      'Missing required env vars: VAPI_API_KEY, PUBLIC_BACKEND_URL, VAPI_WEBHOOK_SECRET',
    );
  }

  const dryRun = isDryRun();
  console.log(`\n[create-fresh] mode = ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`[create-fresh] webhook url = ${webhookUrl}\n`);

  const payload = await loadAssistantConfig({ webhookUrl, webhookSecret });
  const toolCount = Array.isArray(
    (payload['model'] as Record<string, unknown> | undefined)?.['tools'],
  )
    ? (((payload['model'] as Record<string, unknown>)['tools']) as unknown[]).length
    : 0;

  console.log(`[create-fresh] payload built:`);
  console.log(`  name         : ${payload['name']}`);
  console.log(`  model        : ${(payload['model'] as Record<string, unknown>)['model']}`);
  console.log(`  tool count   : ${toolCount}`);
  console.log(`  serverUrl    : ${payload['serverUrl']}`);

  if (dryRun) {
    console.log('\n[create-fresh] DRY RUN — would POST /assistant. Run with --apply to execute.');
    await appendAudit('create-fresh-dry-run', { tool_count: toolCount });
    return;
  }

  console.log('\n[create-fresh] POST /assistant ...');
  const client = new VapiClient({ apiKey });
  const created = await client.createAssistant(payload);

  console.log('  created id   :', created.id);
  console.log('  created name :', created.name ?? '<unknown>');

  await appendAudit('create-fresh', {
    new_id: created.id,
    name: created.name ?? null,
    tool_count: toolCount,
  });

  console.log('\n[create-fresh] DONE.');
  console.log('========================================================');
  console.log('  ACTION REQUIRED:');
  console.log('  Update .env.local at the repo root, replacing BOTH:');
  console.log(`    VAPI_ASSISTANT_ID=${created.id}`);
  console.log(`    NEXT_PUBLIC_VAPI_ASSISTANT_ID=${created.id}`);
  console.log('========================================================\n');
}

main().catch(async (err: unknown) => {
  if (err instanceof VapiError) {
    console.error(`\n[create-fresh] Vapi API error (${err.status} ${err.method}): ${err.message}`);
    await appendAudit('create-fresh-error', {
      kind: 'VapiError',
      status: err.status,
      method: err.method,
    }).catch(() => undefined);
  } else if (err instanceof Error) {
    console.error(`\n[create-fresh] ${err.message}`);
    await appendAudit('create-fresh-error', { kind: 'Error', message: err.message }).catch(
      () => undefined,
    );
  } else {
    console.error('\n[create-fresh] Unknown error:', err);
  }
  process.exit(1);
});
