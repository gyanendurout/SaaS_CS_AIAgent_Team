'use client';

import { useEffect, useState } from 'react';
import { fmtBannerDate, fmtClock } from '@/lib/format';

interface HeaderProps {
  /** Right-of-LIVE pill label, e.g. "2 ACTIVE CALLS" or "HISTORICAL VIEW". */
  pulseLabel: string;
}

/**
 * Top app header: JOOLA wordmark + LIVE pulse + clock + CS Lead tag.
 * The wordmark is an SVG inline so it renders consistently against dark theme
 * without needing to ship a separate asset for first paint.
 */
export function Header({ pulseLabel }: HeaderProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="hdr">
      <div className="hdr__brand">
        <span
          aria-label="JOOLA"
          className="font-display text-[20px] tracking-[0.18em] text-ops-fg"
        >
          JOOLA
        </span>
        <div className="hdr__divider" />
        <div className="hdr__title">
          CS COMMAND
          <small>Warranty AI · Live</small>
        </div>
      </div>

      <div className="hdr__center">
        <span className="live-pill">
          <span className="dot" />
          LIVE · {pulseLabel}
        </span>
        {now && (
          <span className="clock mono">
            {fmtClock(now)}
            <span>·</span>
            {fmtBannerDate(now)}
            <span>·</span>
            EST
          </span>
        )}
      </div>

      <div className="hdr__user">
        <div className="user-tag">
          <div className="avatar">AL</div>
          <div className="meta">
            <b>Aisha Liu</b>
            <span>CS LEAD</span>
          </div>
        </div>
      </div>
    </header>
  );
}
