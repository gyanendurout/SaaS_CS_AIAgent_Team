'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/format';

const baseControl =
  'block w-full rounded-sm border border-joola-mist bg-white px-3 py-2 font-sans text-sm text-joola-ink ' +
  'placeholder:text-joola-stone focus:border-joola-black focus:outline-none focus:ring-2 focus:ring-joola-yellow ' +
  'disabled:cursor-not-allowed disabled:bg-joola-paper';

export function FieldLabel({
  htmlFor,
  required,
  children,
  hint,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 flex items-baseline justify-between font-sans text-xs font-bold uppercase tracking-mega text-joola-graphite"
    >
      <span>
        {children}
        {required && <span className="ml-1 text-joola-red">*</span>}
      </span>
      {hint && <span className="text-[10px] font-normal normal-case tracking-normal text-joola-stone">{hint}</span>}
    </label>
  );
}

type WrapperProps = {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
};

export function Field({ label, required, hint, error, children, id, className }: WrapperProps) {
  return (
    <div className={cx('mb-4', className)}>
      {label && (
        <FieldLabel htmlFor={id} required={required} hint={hint}>
          {label}
        </FieldLabel>
      )}
      {children}
      {error && <p className="mt-1 text-xs text-joola-red">{error}</p>}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(baseControl, className)} {...rest} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, rows = 6, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cx(baseControl, 'resize-y', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx(baseControl, 'pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);
