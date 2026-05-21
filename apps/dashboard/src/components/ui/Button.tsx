'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:   'bg-ops-yellow text-joola-black hover:bg-joola-yellow-deep border border-ops-yellow font-bold',
  secondary: 'bg-transparent text-ops-fg hover:bg-ops-panel-3 border border-ops-line-2 font-semibold',
  danger:    'bg-transparent text-ops-red hover:bg-ops-red/10 border border-ops-red/40 font-semibold',
  ghost:     'bg-transparent text-ops-fg-2 hover:text-ops-fg border-0',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-3 py-1 text-[10px] tracking-[0.12em]',
  md: 'px-4 py-2 text-[11px] tracking-[0.14em]',
};

/**
 * Minimal JOOLA-styled button. Uppercase + mono-leaning typography to match
 * the ops design language. Use `variant="primary"` for yellow CTAs, danger
 * for destructive actions, ghost for icon-only triggers.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 uppercase font-sans transition-colors disabled:opacity-50 disabled:cursor-default ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
