'use client';

import { Button } from '@/components/ui/Button';

export function VoiceErrorBanner({
  message,
  onDismiss,
  onRetry,
}: {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-sm border border-joola-red bg-rose-50 p-3"
    >
      <span aria-hidden className="font-mono text-sm text-joola-red">
        !
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-sans text-sm font-bold uppercase tracking-tight text-joola-red">
          Voice connection issue
        </p>
        <p className="m-0 mt-1 text-xs text-joola-graphite">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
