/**
 * vapi:recreate — Option B assistant lifecycle: delete existing + create fresh.
 *
 * SAFETY PIPELINE (all gates must pass before delete):
 *   1. loadEnv()  — refuses to run if required env missing.
 *   2. getAssistant(VAPI_ASSISTANT_ID) — proves the assistant exists and we
 *      can reach the API.
 *   3. assertNameContainsJoola() — refuses to touch any assistant whose name
 *      does not contain "joola" (case-insensitive).
 *   4. Dry-run gate — exits cleanly unless --apply is passed.
 *   5. requireConfirm("DELETE-CONFIRM") — operator must type the literal
 *      string on the terminal.
 *   6. deleteAssistant().
 *   7. loadAssistantConfig() + createAssistant().
 *   8. Print the new assistant id and remind the operator to update
 *      VAPI_ASSISTANT_ID in .env.local.
 *
 * Every step is audit-logged.
 */

import {
  loadEnv,
  isDryRun,
  requireConfirm,
  appendAudit,
  assertNameContainsJoola,
  loadAssistantConfig,
} from './safety.js';
import { VapiClient, VapiError } from './vapi-client.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const dryRun = isDryRun();
  const client = new VapiClient({ apiKey: env.VAPI_API_KEY });

  console.log(`\n[recreate] mode = ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`[recreate] target id = ${env.VAPI_ASSISTANT_ID}`);
  console.log(`[recreate] webhook url = ${env.PUBLIC_BACKEND_URL}\n`);

  // 1+2: Verify the assistant exists and we have API access.
  console.log('[recreate] Step 1: GET existing assistant to verify access...');
  const existing = await client.getAssistant(env.VAPI_ASSISTANT_ID);

  console.log('  found id    :', existing.id);
  console.log('  found name  :', existing.name ?? '<unknown>');
  console.log(
    '  found tools :',
    (existing.model?.tools?.length ?? 0).toString(),
  );

  // 3: Name guard. Throws if not joola.
  console.log('\n[recreate] Step 2: Asserting name contains "joola"...');
  assertNameContainsJoola(existing.name);
  console.log('  OK — name passes guard.');

  // 4: Dry-run early exit.
  if (dryRun) {
    console.log(
      '\n[recreate] DRY RUN complete. Would delete the assistant above and ' +
        'POST a fresh one using packages/vapi-assistant-config/assistant.json. ' +
        '\nRun with --apply to execute.',
    );
    await appendAudit('recreate-dry-run', {
      assistant_id: existing.id,
      name: existing.name ?? null,
    });
    return;
  }

  // 5: Typed confirmation.
  console.log('');
  await requireConfirm(
    `Type DELETE-CONFIRM to proceed with deleting assistant '${existing.name ?? '<unknown>'}' (${existing.id}):`,
    'DELETE-CONFIRM',
  );

  // 6: Delete.
  console.log('\n[recreate] Step 3: Deleting existing assistant...');
  await client.deleteAssistant(env.VAPI_ASSISTANT_ID);
  console.log('  deleted.');
  await appendAudit('recreate-delete', {
    deleted_id: existing.id,
    name: existing.name ?? null,
  });

  // 7: Build payload + create.
  console.log(
    '\n[recreate] Step 4: Loading assistant config + tool schemas from ' +
      'packages\\vapi-assistant-config\\...',
  );
  const payload = await loadAssistantConfig({
    webhookUrl: env.PUBLIC_BACKEND_URL,
    webhookSecret: env.VAPI_WEBHOOK_SECRET,
  });

  const toolCount =
    Array.isArray(
      (payload['model'] as Record<string, unknown> | undefined)?.['tools'],
    )
      ? ((payload['model'] as Record<string, unknown>)['tools'] as unknown[])
          .length
      : 0;

  console.log(
    `  loaded. system prompt + ${toolCount} tools + webhook config.`,
  );

  console.log('\n[recreate] Step 5: POST /assistant ...');
  const created = await client.createAssistant(payload);
  console.log('  created id   :', created.id);
  console.log('  created name :', created.name ?? '<unknown>');

  await appendAudit('recreate-create', {
    old_id: existing.id,
    new_id: created.id,
    name: created.name ?? null,
    tool_count: toolCount,
  });

  console.log('\n[recreate] DONE.');
  console.log('========================================================');
  console.log('  ACTION REQUIRED:');
  console.log('  Update .env.local at the repo root:');
  console.log(`    VAPI_ASSISTANT_ID=${created.id}`);
  console.log('========================================================\n');
}

main().catch(async (err: unknown) => {
  if (err instanceof VapiError) {
    console.error(`\n[recreate] Vapi API error: ${err.message}`);
    await appendAudit('recreate-error', {
      kind: 'VapiError',
      status: err.status,
      method: err.method,
    }).catch(() => undefined);
  } else if (err instanceof Error) {
    console.error(`\n[recreate] ${err.message}`);
    await appendAudit('recreate-error', {
      kind: 'Error',
      message: err.message,
    }).catch(() => undefined);
  } else {
    console.error('\n[recreate] Unknown error:', err);
  }
  process.exit(1);
});
