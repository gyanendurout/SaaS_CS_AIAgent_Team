import { createClient } from '../apps/api/node_modules/@supabase/supabase-js/dist/index.mjs';

const sb = createClient(
  process.env.SUPABASE_URL ?? 'https://isrcdvhtfnbzlnvhgule.supabase.co',
  process.env.SUPABASE_SECRET_KEY ?? '',
  { auth: { persistSession: false } },
);

const { data: customers } = await sb
  .from('customers')
  .select('id, name, email, country')
  .order('name');

const { data: orders } = await sb
  .from('orders')
  .select('id, order_number, customer_id, product_name, product_sku, purchase_date, source, authorized')
  .order('purchase_date', { ascending: false });

const { data: regs } = await sb
  .from('registrations')
  .select('order_id, registered, within_window, receipt_approved, nfc_id');

const ordById = new Map(orders.map((o) => [o.id, o]));
const regByOrder = new Map(regs.map((r) => [r.order_id, r]));
const ordsByCust = new Map();
for (const o of orders) {
  if (!ordsByCust.has(o.customer_id)) ordsByCust.set(o.customer_id, []);
  ordsByCust.get(o.customer_id).push(o);
}

console.log('\n── Customers + their orders ─────────────────────────\n');
for (const c of customers) {
  const co = ordsByCust.get(c.id) ?? [];
  console.log(`${c.name.padEnd(22)} ${c.email.padEnd(32)} (${c.country})`);
  for (const o of co) {
    const r = regByOrder.get(o.id);
    const rstr = r
      ? `reg:${r.registered ? 'Y' : 'N'} window:${r.within_window ? 'Y' : 'N'} receipt:${r.receipt_approved ? 'Y' : 'N'}`
      : 'no-reg';
    console.log(
      `  • ${o.order_number.padEnd(12)} ${o.product_name.padEnd(28)} ` +
      `src=${o.source.padEnd(10)} auth=${o.authorized ? 'Y' : 'N'} ` +
      `${o.purchase_date}  ${rstr}`,
    );
  }
}
console.log();
