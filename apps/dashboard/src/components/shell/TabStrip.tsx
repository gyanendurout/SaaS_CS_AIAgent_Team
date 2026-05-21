'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TabStripProps {
  /** Badge count shown next to the "Live operations" tab. */
  liveBadge?: string;
  /** Badge count shown next to the "Archive" tab. */
  archiveBadge?: string;
}

/**
 * Live | Archive route switcher. Uses pathname to mark the active tab so
 * URL state is the source of truth (back/forward buttons just work).
 */
export function TabStrip({ liveBadge = '', archiveBadge = '' }: TabStripProps) {
  const pathname = usePathname();
  const isLive = pathname?.startsWith('/live') ?? false;
  const isArchive = pathname?.startsWith('/archive') ?? false;

  return (
    <div className="tabs" role="tablist">
      <Link
        href="/live"
        role="tab"
        aria-selected={isLive}
        className={`tab ${isLive ? 'is-active' : ''}`}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isLive ? 'var(--ops-yellow)' : 'var(--ops-fg-3)',
            boxShadow: isLive ? '0 0 0 3px rgba(245,230,37,0.2)' : 'none',
          }}
        />
        Live operations
        {liveBadge && <span className="badge">{liveBadge}</span>}
      </Link>

      <Link
        href="/archive"
        role="tab"
        aria-selected={isArchive}
        className={`tab ${isArchive ? 'is-active' : ''}`}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isArchive ? 'var(--ops-yellow)' : 'var(--ops-fg-3)',
          }}
        />
        Archive · Reports
        {archiveBadge && <span className="badge">{archiveBadge}</span>}
      </Link>

      <span className="tab-spacer" />
      <span className="tab-meta">
        {isLive
          ? 'REAL-TIME · SUPABASE REALTIME · POLICY v' +
            (process.env.NEXT_PUBLIC_POLICY_VERSION ?? '1.0.0')
          : 'HISTORICAL · READ-ONLY · POINT-IN-TIME SNAPSHOT'}
      </span>
    </div>
  );
}
