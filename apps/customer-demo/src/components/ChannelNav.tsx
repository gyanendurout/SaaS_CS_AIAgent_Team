'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/format';

const TABS = [
  { href: '/call', label: 'Call', short: 'Voice' },
  { href: '/email', label: 'Email', short: 'Inbox' },
  { href: '/web', label: 'Web Form', short: 'Case' },
] as const;

/**
 * Sticky three-tab navigation. Sits below the header and above the channel
 * content so the CS Lead can move between channels with one click during the
 * demo.
 */
export function ChannelNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav className="sticky top-[57px] z-30 border-b border-joola-fog bg-white">
      <div className="mx-auto flex max-w-6xl items-stretch gap-1 px-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                'group relative flex flex-col items-center px-5 py-3 no-underline transition-colors',
                active ? 'text-joola-black' : 'text-joola-stone hover:text-joola-black',
              )}
            >
              <span className="font-sans text-sm font-bold uppercase tracking-tight">
                {tab.label}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-mega text-joola-stone group-hover:text-joola-graphite">
                {tab.short}
              </span>
              <span
                aria-hidden
                className={cx(
                  'absolute inset-x-2 -bottom-px h-[3px]',
                  active ? 'bg-joola-yellow' : 'bg-transparent',
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
