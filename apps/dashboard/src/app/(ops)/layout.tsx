import type { ReactNode } from 'react';
import { Header } from '@/components/shell/Header';
import { TabStrip } from '@/components/shell/TabStrip';
import { CaseDrawer } from '@/components/drawer/CaseDrawer';

/**
 * Shared ops shell. Wraps both /live and /archive so the header / tab strip
 * stay mounted across navigations (no flicker, no re-subscribe). The case
 * drawer also lives here — it's URL-driven via ?case=… and works from
 * either route.
 *
 * IMPORTANT: the .app CSS grid template is grid-template-rows: 64px 44px 1fr —
 * the page's own component (Live or Archive) is responsible for filling the
 * last 1fr row, which includes any sub-strip (KPIs).
 */
export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <Header pulseLabel="OPERATIONS" />
      <TabStrip />
      {children}
      <CaseDrawer />
    </div>
  );
}
