'use client';

import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Optional extra classes for the dialog box. */
  className?: string;
}

/**
 * Base scrim+dialog. Escape closes, clicking the scrim closes. The dialog
 * itself stops click propagation so clicks inside don't bubble to the scrim.
 */
export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  // Esc-to-close, mounted only while the modal is visible.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className={`min-w-[420px] max-w-[640px] border border-ops-yellow bg-ops-panel shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-ops-line px-5 py-4">
            <div className="font-display text-[14px] uppercase tracking-[0.14em] text-ops-fg">
              {title}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center border border-ops-line-2 text-ops-fg-2 hover:text-ops-yellow"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
