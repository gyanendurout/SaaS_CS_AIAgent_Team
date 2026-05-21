'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { submitWebForm } from '@/lib/api/web';
import { useSupabase } from '@/providers/SupabaseProvider';

// Product options the form exposes. Maps loosely to product_type enum values
// — the backend normalizes the rest.
const PRODUCT_OPTIONS = [
  'Pickleball Paddle — Standard',
  'Pickleball Paddle — NFC',
  'Pickleball Net',
  'Pickleball Bag',
  'Pickleball Eyewear',
  'Table Tennis — Indoor Table',
  'Table Tennis — Outdoor Table',
  'Table Tennis — Recreational Racket',
  'Table Tennis — Customized Racket',
  'Table Tennis — Blades',
  'Table Tennis — Rubbers',
  'Table Tennis — Balls',
  'Apparel',
  'Other',
] as const;
const DEFAULT_PRODUCT: (typeof PRODUCT_OPTIONS)[number] = 'Pickleball Paddle — Standard';

type Props = {
  /** Called once submission succeeds with a claim_id. */
  onSubmitted: (claimId: string) => void;
};

export function WebFormSubmit({ onSubmitted }: Props) {
  const { current } = useSupabase();
  const { toast, ToastContainer } = useToast();

  const [orderNumber, setOrderNumber] = useState('');
  const [product, setProduct] = useState<string>(DEFAULT_PRODUCT);
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [issue, setIssue] = useState('');
  const [photosUploaded, setPhotosUploaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!current) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current) return;
    if (!issue.trim()) {
      toast({ tone: 'warning', title: 'Tell us what happened', message: 'The issue description is required.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitWebForm({
        customer_id: current.id,
        order_number: orderNumber.trim() || undefined,
        product,
        issue: issue.trim(),
        urgency,
        photos_uploaded: photosUploaded,
      });
      toast({
        tone: 'success',
        title: 'Case opened',
        message: `Your case ID is ${res.claim_id}`,
      });
      onSubmitted(res.claim_id);
      // Keep order/product in place for fast multi-case demos; clear issue text.
      setIssue('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      toast({ tone: 'error', title: "Couldn't submit", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Order #" hint="If you have it">
            <TextInput
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="JOO-10421"
              className="font-mono"
            />
          </Field>
          <Field label="Product" required>
            <Select value={product} onChange={(e) => setProduct(e.target.value)}>
              {PRODUCT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="What happened?" required>
          <TextArea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Describe what happened — when you noticed it, what you tried, anything else we should know…"
            rows={6}
          />
        </Field>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Urgency">
            <Select
              value={urgency}
              onChange={(e) =>
                setUrgency(e.target.value as 'low' | 'normal' | 'high' | 'urgent')
              }
            >
              <option value="low">Low — no rush</option>
              <option value="normal">Normal</option>
              <option value="high">High — tournament soon</option>
              <option value="urgent">Urgent — safety / event tomorrow</option>
            </Select>
          </Field>
          <Field label="Attach photos" hint="Mock upload — for demo">
            <button
              type="button"
              onClick={() => setPhotosUploaded((v) => !v)}
              className={
                photosUploaded
                  ? 'flex h-10 items-center justify-center gap-2 rounded-sm border border-joola-court-green bg-emerald-50 px-3 font-sans text-sm font-semibold uppercase tracking-tight text-joola-court-green'
                  : 'flex h-10 items-center justify-center gap-2 rounded-sm border border-dashed border-joola-mist bg-white px-3 font-sans text-sm text-joola-graphite hover:border-joola-black'
              }
            >
              {photosUploaded ? 'Photos uploaded ✓' : '+ Add photos'}
            </button>
          </Field>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <Button type="submit" loading={submitting}>
            Open case
          </Button>
        </div>
      </form>
      {ToastContainer}
    </>
  );
}
