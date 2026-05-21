'use client';

import type { ReactNode } from 'react';

/**
 * Reserved wrapper for any future per-page chrome (toolbars, breadcrumbs).
 * For now it just renders children — the (ops) layout already owns
 * Header + TabStrip + Drawer, and per-route pages own their own grid.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
