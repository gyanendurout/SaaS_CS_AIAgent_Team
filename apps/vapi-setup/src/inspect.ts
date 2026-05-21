/**
 * vapi:inspect — read-only inspection of the JOOLA Vapi assistant.
 *
 * Safe to run any time. Prints summary, appends an audit entry. Never
 * modifies the assistant. Does not require --apply.
 */

import { loadEnv, appendAudit, nameContainsJoola } from './safety.js';
import { VapiClient, VapiError } from './vapi-client.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const client = new VapiClient({ apiKey: env.VAPI_API_KEY });

  console.log(`\n[inspect] Fetching assistant ${env.VAPI_ASSISTANT_ID}...\n`);

  const a = await client.getAssistant(env.VAPI_ASSISTANT_ID);

  const tools = a.model?.tools ?? [];
  const toolNames = tools
    .map((t) => {
      const obj = t as { function?: { name?: string } };
      return obj.function?.name ?? '<unnamed>';
    })
    .join(', ');

  const guarded = nameContainsJoola(a.name);

  console.log('  id              :', a.id);
  console.log('  name            :', a.name ?? '<unknown>');
  console.log('  joola-guard     :', guarded ? 'PASS (name contains joola)' : 'FAIL (name does NOT contain joola)');
  console.log('  model.provider  :', a.model?.provider ?? '<unset>');
  console.log('  model.model     :', a.model?.model ?? '<unset>');
  console.log('  voice.provider  :', a.voice?.provider ?? '<unset>');
  console.log('  voice.voiceId   :', a.voice?.voiceId ?? '<unset>');
  console.log('  tool count      :', tools.length);
  console.log('  tool names      :', toolNames || '<none>');
  console.log('  serverUrl       :', a.serverUrl ?? '<unset>');
  console.log('  firstMessage    :', (a.firstMessage ?? '').slice(0, 120));
  console.log('');

  await appendAudit('inspect', {
    assistant_id: a.id,
    name: a.name ?? null,
    name_contains_joola: guarded,
    tool_count: tools.length,
  });

  if (!guarded) {
    console.warn(
      '[inspect] WARNING: this assistant\'s name does NOT contain "joola". ' +
        'Destructive scripts will refuse to act on it.',
    );
  }
}

main().catch((err: unknown) => {
  if (err instanceof VapiError) {
    console.error(`[inspect] Vapi API error: ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`[inspect] ${err.message}`);
  } else {
    console.error('[inspect] Unknown error:', err);
  }
  process.exit(1);
});
