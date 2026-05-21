/**
 * vapi:update-webhook — PATCH only the serverUrl on the JOOLA Vapi assistant.
 *
 * Used when the public backend URL changes (e.g., ngrok tunnel restart) but
 * the rest of the assistant config is unchanged. Same safety gates as
 * recreate, minus the typed DELETE-CONFIRM (this op is reversible).
 */

import {
  loadEnv,
  isDryRun,
  appendAudit,
  assertNameContainsJoola,
} from './safety.js';
import { VapiClient, VapiError } from './vapi-client.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const dryRun = isDryRun();
  const client = new VapiClient({ apiKey: env.VAPI_API_KEY });

  console.log(`\n[update-webhook] mode = ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`[update-webhook] target id = ${env.VAPI_ASSISTANT_ID}\n`);

  console.log('[update-webhook] Step 1: GET existing assistant to verify access...');
  const existing = await client.getAssistant(env.VAPI_ASSISTANT_ID);
  console.log('  name        :', existing.name ?? '<unknown>');
  console.log('  current url :', existing.serverUrl ?? '<unset>');
  console.log('  new url     :', env.PUBLIC_BACKEND_URL);

  console.log('\n[update-webhook] Step 2: Asserting name contains "joola"...');
  assertNameContainsJoola(existing.name);
  console.log('  OK — name passes guard.');

  if (existing.serverUrl === env.PUBLIC_BACKEND_URL) {
    console.log(
      '\n[update-webhook] No change needed — current serverUrl already matches PUBLIC_BACKEND_URL.',
    );
    await appendAudit('update-webhook-noop', {
      assistant_id: existing.id,
      url: env.PUBLIC_BACKEND_URL,
    });
    return;
  }

  if (dryRun) {
    console.log(
      '\n[update-webhook] DRY RUN complete. Would PATCH serverUrl. ' +
        'Run with --apply to execute.',
    );
    await appendAudit('update-webhook-dry-run', {
      assistant_id: existing.id,
      from: existing.serverUrl ?? null,
      to: env.PUBLIC_BACKEND_URL,
    });
    return;
  }

  console.log('\n[update-webhook] Step 3: PATCH /assistant/{id} ...');
  await client.updateAssistant(env.VAPI_ASSISTANT_ID, {
    serverUrl: env.PUBLIC_BACKEND_URL,
    serverUrlSecret: env.VAPI_WEBHOOK_SECRET,
  });
  console.log('  patched.');

  await appendAudit('update-webhook', {
    assistant_id: existing.id,
    from: existing.serverUrl ?? null,
    to: env.PUBLIC_BACKEND_URL,
  });

  console.log('\n[update-webhook] DONE.\n');
}

main().catch(async (err: unknown) => {
  if (err instanceof VapiError) {
    console.error(`\n[update-webhook] Vapi API error: ${err.message}`);
    await appendAudit('update-webhook-error', {
      kind: 'VapiError',
      status: err.status,
      method: err.method,
    }).catch(() => undefined);
  } else if (err instanceof Error) {
    console.error(`\n[update-webhook] ${err.message}`);
    await appendAudit('update-webhook-error', {
      kind: 'Error',
      message: err.message,
    }).catch(() => undefined);
  } else {
    console.error('\n[update-webhook] Unknown error:', err);
  }
  process.exit(1);
});
