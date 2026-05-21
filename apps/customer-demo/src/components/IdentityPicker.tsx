'use client';

import { useSupabase } from '@/providers/SupabaseProvider';

/**
 * Header dropdown that switches the "play as" customer.
 *
 * The currently-selected customer drives:
 *  - the Vapi assistant context variables (passed at call start)
 *  - the email inbox filter + compose `from_addr`
 *  - the web-form `customer_id` payload
 */
export function IdentityPicker() {
  const { identities, current, loading, fromDb, selectCustomer } = useSupabase();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="identity"
        className="hidden font-sans text-xs font-bold uppercase tracking-mega text-joola-stone sm:inline"
      >
        Play as
      </label>
      <div className="relative">
        <select
          id="identity"
          value={current?.id ?? ''}
          onChange={(e) => selectCustomer(e.target.value)}
          disabled={loading || identities.length === 0}
          className="h-9 min-w-[200px] rounded-sm border border-joola-mist bg-white pl-3 pr-8 font-sans text-sm text-joola-ink focus:border-joola-black focus:outline-none focus:ring-2 focus:ring-joola-yellow disabled:opacity-50"
        >
          {identities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.email}
            </option>
          ))}
        </select>
      </div>
      {!fromDb && !loading && (
        <span
          title="Loaded from fallback list — run seed migration 0002 to populate the customers table"
          className="rounded-pill border border-warning/40 bg-yellow-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-warning"
        >
          fallback
        </span>
      )}
    </div>
  );
}
