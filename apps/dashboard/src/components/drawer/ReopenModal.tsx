'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { reopenCase } from '@/lib/api/cases';
import type { ReopenCategory } from '@/lib/supabase/types';

interface ReopenModalProps {
  open: boolean;
  claimId: string | null;
  onClose: () => void;
}

const CATEGORIES: Array<{ value: ReopenCategory; label: string }> = [
  { value: 'customer_disputed', label: 'Customer disputed decision' },
  { value: 'damage_worsened',   label: 'Damage has worsened' },
  { value: 'new_info',          label: 'New information available' },
  { value: 'other',             label: 'Other' },
];

/**
 * Required: category enum + a non-empty note (min 5 chars to mirror the
 * reopen_consistency CHECK constraint in migration 0001). On success we
 * navigate to /live with the case drawer still open so the CS Lead sees
 * the reopened case land in the feed.
 */
export function ReopenModal({ open, claimId, onClose }: ReopenModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState<ReopenCategory>('customer_disputed');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!claimId) return;
    if (note.trim().length < 5) {
      setError('Note must be at least 5 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reopenCase(claimId, { category, note: note.trim() });
      toast.push('Reopened — switching to Live', 'success');
      onClose();
      router.push(`/live?case=${encodeURIComponent(claimId)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reopen failed';
      setError(msg);
      toast.push(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={<>Reopen case {claimId ?? ''}</>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="eyebrow">Reopen category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReopenCategory)}
            disabled={busy}
            className="border border-ops-line-2 bg-ops-panel-2 px-3 py-2 text-[13px] text-ops-fg outline-none focus:border-ops-yellow"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="eyebrow">Note (min 5 characters)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            rows={4}
            className="resize-vertical border border-ops-line-2 bg-ops-panel-2 px-3 py-2 font-mono text-[12px] text-ops-fg outline-none focus:border-ops-yellow"
            placeholder="Why is this being reopened? Will be persisted on the claim."
          />
        </div>
        {error && (
          <div className="border border-ops-red/40 bg-ops-red/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ops-red">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || note.trim().length < 5}>
            {busy ? 'Reopening…' : 'Reopen → Live'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
