/**
 * vapi:add-tool — add ONE tool schema to the existing JOOLA assistant, in place.
 *
 * Unlike `recreate` (delete + create = new assistant id), this PATCHes the
 * same assistant, so VAPI_ASSISTANT_ID / NEXT_PUBLIC_VAPI_ASSISTANT_ID stay
 * valid. Only `model.tools` changes: the existing model object (prompt,
 * temperature, dashboard tuning) is sent back untouched apart from the tool.
 *
 *   pnpm vapi:add-tool -- search_knowledge            # dry run
 *   pnpm vapi:add-tool:apply -- search_knowledge      # PATCH
 *
 * Before applying, the current model is saved to backups/<timestamp>-model.json
 * (gitignored) so it can be restored with a PATCH { model: <backup> }.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  APP_ROOT,
  CONFIG_PKG_ROOT,
  appendAudit,
  assertNameContainsJoola,
  isDryRun,
  loadEnv,
} from './safety.js';
import { VapiClient, VapiError } from './vapi-client.js';

function toolName(tool: unknown): string | undefined {
  const fn = (tool as { function?: { name?: unknown } } | null)?.function;
  return typeof fn?.name === 'string' ? fn.name : undefined;
}

async function main(): Promise<void> {
  const name = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!name || !/^[a-z_]+$/.test(name)) {
    throw new Error('usage: add-tool <tool_name>  (file packages/vapi-assistant-config/tools/<tool_name>.json)');
  }

  const env = loadEnv();
  const dryRun = isDryRun();
  const client = new VapiClient({ apiKey: env.VAPI_API_KEY });

  const schemaPath = path.join(CONFIG_PKG_ROOT, 'tools', `${name}.json`);
  const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8')) as unknown;
  if (toolName(schema) !== name) {
    throw new Error(`${schemaPath} does not define function "${name}"`);
  }

  console.log(`\n[add-tool] mode = ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`[add-tool] target id = ${env.VAPI_ASSISTANT_ID}`);

  const existing = await client.getAssistant(env.VAPI_ASSISTANT_ID);
  assertNameContainsJoola(existing.name);
  const model = existing.model ?? {};
  const tools = Array.isArray(model.tools) ? model.tools : [];
  const before = tools.map(toolName);
  console.log('  name         :', existing.name);
  console.log('  tools before :', before.join(', ') || '<none>');

  const nextTools = [...tools.filter((t) => toolName(t) !== name), schema];
  console.log('  tools after  :', nextTools.map(toolName).join(', '));

  if (dryRun) {
    console.log('\n[add-tool] DRY RUN complete. Run with --apply to PATCH.');
    await appendAudit('add-tool-dry-run', { assistant_id: existing.id, tool: name });
    return;
  }

  const backupDir = path.join(APP_ROOT, 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-model.json`,
  );
  await fs.writeFile(backupPath, JSON.stringify(model, null, 2), 'utf8');
  console.log('  backup       :', backupPath);

  const updated = await client.updateAssistant(env.VAPI_ASSISTANT_ID, {
    model: { ...model, tools: nextTools },
  });
  const after = (updated.model?.tools ?? []).map(toolName);
  console.log('  tools now    :', after.join(', '));

  await appendAudit('add-tool', {
    assistant_id: existing.id,
    tool: name,
    before,
    after,
    backup: path.basename(backupPath),
  });
  console.log('\n[add-tool] DONE (same assistant id).');
}

main().catch(async (err: unknown) => {
  const message = err instanceof VapiError ? `Vapi API error: ${err.message}` : String(err);
  console.error(`\n[add-tool] ${message}`);
  await appendAudit('add-tool-error', { error: message }).catch(() => undefined);
  process.exitCode = 1;
});
