'use client';

import Link from 'next/link';
import { IdentityPicker } from './IdentityPicker';

/**
 * Top-of-page header. Logo + product label on the left, identity picker on
 * the right. Sticks to the top so the picker is always reachable while the
 * CS Lead is navigating between channels mid-demo.
 */
export function DemoHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-joola-fog bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-sm bg-joola-black font-display text-xs font-black text-joola-yellow"
          >
            J
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-base uppercase tracking-tight text-joola-black">
              JOOLA
            </span>
            <span className="font-sans text-[10px] font-bold uppercase tracking-mega text-joola-stone">
              Customer Support
            </span>
          </div>
        </Link>
        <IdentityPicker />
      </div>
    </header>
  );
}
