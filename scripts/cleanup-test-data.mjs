/**
 * One-shot cleanup: removes all transactional test data (claims, emails,
 * drafts, case_events, escalations) while leaving seed tables untouched
 * (customers, orders, registrations, agent_states).
 */

import { createClient } from '../apps/api/node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://isrcdvhtfnbzlnvhgule.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? '';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function count(table) {
  const { count: n, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) return `ERR: ${error.message}`;
  return n ?? 0;
}

async function deleteAll(table) {
  const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`${table}: ${error.message}`);
}

// Deletion order respects FK constraints (children before parents).
const TRANSACTIONAL = ['case_events', 'emails', 'drafts', 'escalations', 'queue_items', 'claims'];
const SEED = ['customers', 'orders', 'registrations', 'agent_states'];

console.log('\n── Current row counts ───────────────────────────────');
for (const t of [...TRANSACTIONAL, ...SEED]) {
  const n = await count(t);
  console.log(`  ${t.padEnd(16)} ${n}`);
}

console.log('\n── Deleting transactional data (FK order) ───────────');
for (const t of TRANSACTIONAL) {
  const before = await count(t);
  if (before === 0 || typeof before === 'string') {
    console.log(`  ${t.padEnd(16)} ${before === 0 ? 'already empty' : before}`);
    continue;
  }
  await deleteAll(t);
  const after = await count(t);
  console.log(`  ${t.padEnd(16)} deleted ${before} rows  (remaining: ${after})`);
}

console.log('\n── Seed tables (untouched) ──────────────────────────');
for (const t of SEED) {
  const n = await count(t);
  console.log(`  ${t.padEnd(16)} ${n} rows preserved`);
}

console.log('\nDone.\n');
