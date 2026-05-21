'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { sendCustomerEmail } from '@/lib/api/email';
import { useSupabase } from '@/providers/SupabaseProvider';

const SUPPORT_ADDR = 'support@joola.com';

/**
 * Compose pane. The "To" field is locked to support@joola.com (this app
 * only models customer -> JOOLA traffic; replies arrive via the inbox).
 */
export function EmailCompose() {
  const { current } = useSupabase();
  const { toast, ToastContainer } = useToast();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  if (!current) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current) return;
    if (!subject.trim() || !body.trim()) {
      toast({ tone: 'warning', title: 'Missing fields', message: 'Add a subject and a message.' });
      return;
    }
    setSending(true);
    try {
      await sendCustomerEmail({
        from_addr: current.email,
        to_addr: SUPPORT_ADDR,
        subject: subject.trim(),
        body: body.trim(),
        customer_id: current.id,
      });
      toast({
        tone: 'success',
        title: 'Email sent',
        message: 'JOOLA AI is on it — reply will land in your inbox.',
      });
      setSubject('');
      setBody('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      toast({ tone: 'error', title: "Couldn't send", message });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col">
        <Field label="From" hint="Locked to your identity">
          <TextInput value={current.email} readOnly disabled />
        </Field>
        <Field label="To" hint="JOOLA Support">
          <TextInput value={SUPPORT_ADDR} readOnly disabled />
        </Field>
        <Field label="Subject" required>
          <TextInput
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Cracked paddle — order #JOO-10421"
            maxLength={140}
          />
        </Field>
        <Field label="Message" required>
          <TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi JOOLA team — tell us what's going on…"
            rows={8}
          />
        </Field>
        <div className="mt-2 flex items-center justify-end">
          <Button type="submit" loading={sending}>
            Send to JOOLA
          </Button>
        </div>
      </form>
      {ToastContainer}
    </>
  );
}
