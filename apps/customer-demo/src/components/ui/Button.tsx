'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

const base =
  'inline-flex items-center justify-center gap-2 font-sans font-semibold uppercase tracking-wide ' +
  'transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-joola-yellow ' +
  'disabled:cursor-not-allowed disabled:opacity-50 rounded-sm';

const variants: Record<Variant, string> = {
  primary: 'bg-joola-yellow text-joola-black hover:bg-joola-yellow-deep',
  secondary: 'border border-joola-black bg-white text-joola-black hover:bg-joola-paper',
  ghost: 'bg-transparent text-joola-ink hover:bg-joola-fog',
  danger: 'bg-joola-red text-white hover:bg-joola-red-deep',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, iconLeft, iconRight, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        iconLeft
      )}
      <span>{children}</span>
      {!loading && iconRight}
    </button>
  );
});
