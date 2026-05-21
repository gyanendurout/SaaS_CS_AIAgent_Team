'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastCtx {
  push: (message: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    // Auto-dismiss after 4 seconds.
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo<ToastCtx>(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2"
      >
        {items.map((t) => (
          <ToastChip key={t.id} item={t} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastChip({ item }: { item: ToastItem }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toneCls =
    item.tone === 'success'
      ? 'border-ops-green/40 text-ops-green'
      : item.tone === 'error'
        ? 'border-ops-red/40 text-ops-red'
        : 'border-ops-yellow/40 text-ops-yellow';

  return (
    <div
      className={`pointer-events-auto min-w-[260px] border bg-ops-panel-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] shadow-xl transition-all ${toneCls} ${
        enter ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
    >
      {item.message}
    </div>
  );
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside <ToastProvider>');
  return v;
}
