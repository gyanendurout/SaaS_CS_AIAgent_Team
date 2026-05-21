'use client';

/**
 * Top-level provider for the customer-demo app.
 *
 * Two responsibilities:
 *  1. Expose a singleton Supabase browser client through context (so every
 *     component reuses the same WebSocket connection for Realtime).
 *  2. Resolve & broadcast the *current customer identity*. Components subscribe
 *     to identity changes (the header dropdown rewrites it) and rebuild their
 *     queries + Realtime channels accordingly.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  FALLBACK_CUSTOMERS,
  chooseDefault,
  readSelectedCustomerId,
  writeSelectedCustomerId,
  type CustomerIdentity,
} from '@/lib/customer-identity';

type Ctx = {
  client: SupabaseClient;
  identities: CustomerIdentity[];
  current: CustomerIdentity | null;
  loading: boolean;
  /** True if the identities came from the database (vs. fallback). */
  fromDb: boolean;
  selectCustomer: (id: string) => void;
  refresh: () => Promise<void>;
};

const SupabaseContext = createContext<Ctx | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      // Allow the UI to render with a null-ish state so the env error surfaces
      // in a friendly banner rather than a crashing render.
      return null;
    }
  }, []);

  const [identities, setIdentities] = useState<CustomerIdentity[]>(FALLBACK_CUSTOMERS);
  const [fromDb, setFromDb] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadIdentities = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await client
      .from('customers')
      .select('id, name, email, phone, country')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error || !data || data.length === 0) {
      setIdentities(FALLBACK_CUSTOMERS);
      setFromDb(false);
    } else {
      setIdentities(data.map((c) => ({ ...c, fromDb: true })));
      setFromDb(true);
    }
    setLoading(false);
  }, [client]);

  // Initial load + read saved selection from localStorage
  useEffect(() => {
    setCurrentId(readSelectedCustomerId());
    void loadIdentities();
  }, [loadIdentities]);

  const current = useMemo<CustomerIdentity | null>(() => {
    if (identities.length === 0) return null;
    if (currentId) {
      const match = identities.find((c) => c.id === currentId);
      if (match) return match;
    }
    return chooseDefault(identities);
  }, [identities, currentId]);

  const selectCustomer = useCallback((id: string) => {
    writeSelectedCustomerId(id);
    setCurrentId(id);
  }, []);

  if (!client) {
    return (
      <div className="min-h-screen bg-joola-paper p-8 text-joola-ink">
        <div className="mx-auto max-w-2xl rounded border border-joola-mist bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-display text-lg uppercase tracking-tight text-joola-black">
            Configuration needed
          </h2>
          <p className="text-sm text-joola-graphite">
            Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to your{' '}
            <code className="font-mono">.env.local</code> and reload.
          </p>
        </div>
      </div>
    );
  }

  const value: Ctx = {
    client,
    identities,
    current,
    loading,
    fromDb,
    selectCustomer,
    refresh: loadIdentities,
  };

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase(): Ctx {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error('useSupabase must be used inside <SupabaseProvider>');
  return ctx;
}
