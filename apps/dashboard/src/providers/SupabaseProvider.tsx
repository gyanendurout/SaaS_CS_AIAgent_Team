'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

/**
 * Lightweight context wrapping the singleton browser client. Auth is a no-op
 * for the demo — the publishable key has anon-level access per the RLS
 * policies in migration 0001. Real auth wiring comes later.
 */

interface SupabaseCtx {
  supabase: SupabaseClient<Database>;
}

const Ctx = createContext<SupabaseCtx | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const value = useMemo<SupabaseCtx>(() => ({ supabase: getBrowserSupabase() }), []);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupabase(): SupabaseClient<Database> {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSupabase must be used inside <SupabaseProvider>');
  return v.supabase;
}
