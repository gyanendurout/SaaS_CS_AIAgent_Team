/**
 * vapi:fix-brand-voice — make the voice say JOOLA as "YOO-la" (not "Julia"),
 * in place on the existing assistant (same id).
 *
 * Three additive changes, everything else is sent back untouched:
 *   1. voice.chunkPlan.formatPlan.replacements — spoken-only rewrite
 *      JOOLA/Joola/joola -> "Yoola" (text, transcripts and tools keep "JOOLA").
 *   2. transcriber.keyterm += "JOOLA" — speech-to-text stops writing "Julia".
 *   3. a short brand-name note inserted into the live system prompt
 *      (only if the marker is not already there).
 *
 *   pnpm vapi:fix-brand-voice            # dry run
 *   pnpm vapi:fix-brand-voice:apply      # PATCH
 *
 * Before applying, voice/transcriber/model are saved to
 * backups/<timestamp>-brand-voice.json (gitignored); restore with
 * PATCH { voice, transcriber, model } from that file.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { APP_ROOT, appendAudit, assertNameContainsJoola, isDryRun, loadEnv } from './safety.js';
import { VapiClient, VapiError } from './vapi-client.js';

export const SPOKEN_BRAND = 'Yoola';
export const BRAND_KEYS = ['JOOLA', 'Joola', 'joola'];
export const PROMPT_MARKER = '## BRAND NAME';
export const PROMPT_NOTE = `${PROMPT_MARKER}

- The brand is written **JOOLA** and pronounced "YOO-la" — never "Julia", "Jula" or "Jolla".
- Speech-to-text may write the customer's "JOOLA" as "Julia", "Jula", "Yola" or "Yoola";
  treat all of these as JOOLA, and always write JOOLA yourself (in text and tool arguments).
`;

type Json = Record<string, unknown>;
interface Replacement {
  type: string;
  key?: string;
  value?: string;
  replaceAllEnabled?: boolean;
}

export function withBrandReplacements(voice: Json): Json {
  const chunkPlan = (voice['chunkPlan'] as Json | undefined) ?? {};
  const formatPlan = (chunkPlan['formatPlan'] as Json | undefined) ?? {};
  const existing = (formatPlan['replacements'] as Replacement[] | undefined) ?? [];
  const kept = existing.filter((r) => !(r.type === 'exact' && r.key && BRAND_KEYS.includes(r.key)));
  const added: Replacement[] = BRAND_KEYS.map((key) => ({
    type: 'exact',
    key,
    value: SPOKEN_BRAND,
    replaceAllEnabled: true,
  }));
  return {
    ...voice,
    chunkPlan: {
      ...chunkPlan,
      enabled: true,
      formatPlan: { ...formatPlan, enabled: true, replacements: [...kept, ...added] },
    },
  };
}

export function withBrandKeyterm(transcriber: Json): Json {
  const terms = (transcriber['keyterm'] as string[] | undefined) ?? [];
  return terms.includes('JOOLA') ? transcriber : { ...transcriber, keyterm: [...terms, 'JOOLA'] };
}

/** Insert the brand note before section 2 (or append) — idempotent. */
export function withBrandNote(prompt: string): string {
  if (prompt.includes(PROMPT_MARKER)) return prompt;
  const at = prompt.search(/^## 2\./m);
  if (at === -1) return `${prompt.trimEnd()}\n\n${PROMPT_NOTE}`;
  return `${prompt.slice(0, at)}${PROMPT_NOTE}\n---\n\n${prompt.slice(at)}`;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const dryRun = isDryRun();
  const client = new VapiClient({ apiKey: env.VAPI_API_KEY });

  console.log(`\n[fix-brand-voice] mode = ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  const existing = await client.getAssistant(env.VAPI_ASSISTANT_ID);
  assertNameContainsJoola(existing.name);

  const voice = (existing['voice'] as Json | undefined) ?? {};
  const transcriber = (existing['transcriber'] as Json | undefined) ?? {};
  const model = (existing['model'] as Json | undefined) ?? {};
  const messages = (model['messages'] as { role: string; content: string }[] | undefined) ?? [];
  const sysIdx = messages.findIndex((m) => m.role === 'system');
  if (sysIdx === -1) throw new Error('live assistant has no system message — refusing to guess');

  const nextVoice = withBrandReplacements(voice);
  const nextTranscriber = withBrandKeyterm(transcriber);
  const nextPrompt = withBrandNote(messages[sysIdx]!.content);
  const nextMessages = messages.map((m, i) => (i === sysIdx ? { ...m, content: nextPrompt } : m));

  console.log('  name               :', existing.name);
  console.log('  voice replacements :', JSON.stringify((nextVoice['chunkPlan'] as Json)['formatPlan']));
  console.log('  transcriber        :', JSON.stringify(nextTranscriber));
  console.log('  prompt note added  :', nextPrompt !== messages[sysIdx]!.content);

  if (dryRun) {
    console.log('\n[fix-brand-voice] DRY RUN complete. Run with --apply to PATCH.');
    await appendAudit('fix-brand-voice-dry-run', { assistant_id: existing.id });
    return;
  }

  const backupDir = path.join(APP_ROOT, 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-brand-voice.json`,
  );
  await fs.writeFile(backupPath, JSON.stringify({ voice, transcriber, model }, null, 2), 'utf8');
  console.log('  backup             :', backupPath);

  await client.updateAssistant(env.VAPI_ASSISTANT_ID, {
    voice: nextVoice,
    transcriber: nextTranscriber,
    model: { ...model, messages: nextMessages },
  } as never);

  await appendAudit('fix-brand-voice', {
    assistant_id: existing.id,
    backup: path.basename(backupPath),
  });
  console.log('\n[fix-brand-voice] DONE (same assistant id).');
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('fix-brand-voice.ts')) {
  main().catch(async (err: unknown) => {
    const message = err instanceof VapiError ? `Vapi API error: ${err.message}` : String(err);
    console.error(`\n[fix-brand-voice] ${message}`);
    await appendAudit('fix-brand-voice-error', { error: message }).catch(() => undefined);
    process.exitCode = 1;
  });
}
