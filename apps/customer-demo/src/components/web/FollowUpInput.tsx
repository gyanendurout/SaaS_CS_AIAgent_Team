'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { submitWebForm } from '@/lib/api/web';
import { useSupabase } from '@/providers/SupabaseProvider';

/**
 * Inline follow-up sender for an open case. POSTs to the same web/inbound
 * endpoint with the existing claim_id so the backend can append to the
 * thread instead of opening a new case.
 */
export function FollowUpInput({ claimId }: { claimId: string }) {
  const { current } = useSupabase();
  const { toast, ToastContainer } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  if (!current) return null;

  async function onSend() {
    if (!current) return;
    if (!text.trim()) return;
    setSending(true);
    try {
      await submitWebForm({
        customer_id: current.id,
        claim_id: claimId,
        issue: text.trim(),
      });
      setText('');
      toast({ tone: 'success', title: 'Follow-up sent' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      toast({ tone: 'error', title: "Couldn't send", message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Need to add more info or ask a follow-up question?"
        rows={3}
      />
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={onSend} loading={sending} disabled={!text.trim()}>
          Send follow-up
        </Button>
      </div>
      {ToastContainer}
    </div>
  );
}
