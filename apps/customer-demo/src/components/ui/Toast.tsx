'use client';

/**
 * Minimal toast — single-shot, dependency-free.
 *
 * Usage:
 *   const { toast, ToastContainer } = useToast();
 *   toast({ tone: 'success', title: 'Sent' });
 *   return (<>{ToastContainer}…</>)
 */

import { useCallback, useMemo, useState } from 'react';
import { cx } from '@/lib/format';

export type Toast = {
  id: number;
  tone?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
};

let nextId = 1;

export function useToast() {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setItems((cur) => [...cur, { ...t, id }]);
    // auto-dismiss after 4s
    window.setTimeout(() => {
      setItems((cur) => cur.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((x) => x.id !== id));
  }, []);

  const ToastContainer = useMemo(
    () => (
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'pointer-events-auto rounded-sm border bg-white p-3 shadow-md',
              t.tone === 'success' && 'border-joola-court-green',
              t.tone === 'warning' && 'border-warning',
              t.tone === 'error' && 'border-joola-red',
              (!t.tone || t.tone === 'info') && 'border-joola-mist',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 font-sans text-sm font-bold uppercase tracking-tight text-joola-black">
                  {t.title}
                </p>
                {t.message && (
                  <p className="m-0 mt-1 text-xs text-joola-graphite">{t.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-mr-1 -mt-1 rounded p-1 text-joola-stone hover:bg-joola-fog"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    ),
    [items, dismiss],
  );

  return { toast, ToastContainer };
}
