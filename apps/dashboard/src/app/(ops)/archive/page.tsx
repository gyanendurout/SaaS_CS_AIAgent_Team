import type { Metadata } from 'next';
import type { Agent } from '@/lib/supabase/types';
import { getServerSupabase } from '@/lib/supabase/server';
import { ArchiveView } from './ArchiveView';

export const metadata: Metadata = { title: 'JOOLA · CS Command' }; // BUG-020

// Archive paints from URL state on every nav; never cached at the route level.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Server entry for /archive. Loads the (small, static) agents reference
 * list and hands it to the client view. All filter parsing happens
 * client-side via useSearchParams so back/forward navigation works.
 */
export default async function ArchivePage() {
  const supabase = getServerSupabase();
  const { data } = await supabase.from('agents').select('*').order('id');
  const agents = (data ?? []) as Agent[];
  return <ArchiveView agents={agents} />;
}
