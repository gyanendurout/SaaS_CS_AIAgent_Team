import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/format';

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Pads the card content. Default `md`. */
  pad?: 'none' | 'sm' | 'md' | 'lg';
  /** Renders with a yellow left accent strip. */
  accent?: boolean;
  children?: ReactNode;
};

const pads = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
} as const;

export function Card({ pad = 'md', accent, className, children, ...rest }: Props) {
  return (
    <div
      className={cx(
        'rounded border border-joola-fog bg-white shadow-sm',
        accent && 'border-l-4 border-l-joola-yellow',
        pads[pad],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-3 flex items-center justify-between gap-3', className)}>{children}</div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cx(
        'm-0 font-sans text-md font-bold uppercase tracking-tight text-joola-black',
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function CardEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-sans text-xs font-bold uppercase tracking-mega text-joola-stone">
      {children}
    </span>
  );
}
