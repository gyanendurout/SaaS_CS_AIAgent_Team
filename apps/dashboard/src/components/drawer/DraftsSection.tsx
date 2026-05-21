'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { approveCaseDraft, editCaseDraft, sendAndAwaitReply } from '@/lib/api/cases';
import type { Draft } from '@/lib/supabase/types';

interface DraftsSectionProps {
  claimId: string;
  draft: Draft | null;
  channel: string;
  /** When true the case is archived — sending is blocked until reopened. */
  isArchived?: boolean;
  /** Called after a successful approve/edit so the drawer reloads. */
  onChanged?: () => void;
}

/**
 * Voice + email drafts awaiting CS Lead approval. Email drafts are inline-
 * editable: the CS lead can tweak the subject + body before pressing
 * "Approve + Send" which dispatches the outbound email and closes the claim.
 */
export function DraftsSection({ claimId, draft, channel, isArchived, onChanged }: DraftsSectionProps) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft?.email_subject ?? '');
  const [body, setBody] = useState(draft?.email_body ?? '');
  const [voice, setVoice] = useState(draft?.voice_text ?? '');
  const [busy, setBusy] = useState(false);

  // Reset local state when a different draft loads.
  useEffect(() => {
    setSubject(draft?.email_subject ?? '');
    setBody(draft?.email_body ?? '');
    setVoice(draft?.voice_text ?? '');
    setEditing(false);
  }, [draft?.id]);

  if (!draft) {
    return (
      <div
        style={{
          fontSize: 12,
          color: 'var(--ops-fg-3)',
          padding: 12,
          border: '1px dashed var(--ops-line)',
        }}
      >
        No drafts yet — the Customer Reply agent has not produced output for this case.
      </div>
    );
  }

  const isApproved = draft.status === 'approved' || draft.status === 'sent';
  const dirty =
    subject !== (draft.email_subject ?? '') ||
    body !== (draft.email_body ?? '') ||
    voice !== (draft.voice_text ?? '');

  const handleSaveEdits = async () => {
    if (!dirty) {
      toast.push('No changes to save', 'info');
      return;
    }
    setBusy(true);
    try {
      await editCaseDraft(claimId, {
        edited_email_subject: channel === 'email' ? subject : undefined,
        edited_email_body: channel === 'email' ? body : undefined,
        edited_voice: channel === 'voice' ? voice : undefined,
      });
      toast.push('Edits saved', 'success');
      setEditing(false);
      onChanged?.();
    } catch (err) {
      toast.push(`Save failed: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveSend = async () => {
    setBusy(true);
    try {
      await approveCaseDraft(claimId, dirty ? {
        edited_email_subject: channel === 'email' ? subject : undefined,
        edited_email_body: channel === 'email' ? body : undefined,
        edited_voice: channel === 'voice' ? voice : undefined,
      } : {});
      toast.push(
        channel === 'email' ? 'Email sent to customer · case closed' : 'Draft approved',
        'success',
      );
      setEditing(false);
      onChanged?.();
    } catch (err) {
      toast.push(`Send failed: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendAwaitReply = async () => {
    setBusy(true);
    try {
      await sendAndAwaitReply(claimId, dirty ? {
        edited_email_subject: channel === 'email' ? subject : undefined,
        edited_email_body: channel === 'email' ? body : undefined,
      } : {});
      toast.push('Info-request sent · awaiting customer reply', 'success');
      setEditing(false);
      onChanged?.();
    } catch (err) {
      toast.push(`Send failed: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="drafts">
        {/* VOICE — read-only here for the email channel */}
        <div className="draft-card">
          <h5>VOICE REPLY · VAPI</h5>
          <div className="sub">~ 15 sec · friendly</div>
          {editing && channel === 'voice' ? (
            <textarea
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              style={editorStyle()}
              rows={4}
            />
          ) : (
            <div className="body">{draft.voice_text ?? '— no voice draft —'}</div>
          )}
        </div>

        <div className="draft-card">
          <h5>EMAIL DRAFT {isApproved && <span style={{ color: 'var(--ops-green)' }}>· SENT</span>}</h5>
          {editing ? (
            <>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                style={{ ...editorStyle(), fontWeight: 700 }}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{ ...editorStyle(), marginTop: 6, minHeight: 200 }}
                rows={10}
              />
            </>
          ) : (
            <>
              <div className="sub">Subject: {draft.email_subject ?? '(no subject)'}</div>
              <div className="body" style={{ whiteSpace: 'pre-wrap' }}>
                {draft.email_body ?? '— no email body —'}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isArchived && !isApproved && (
          <div
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--ops-panel-2)',
              border: '1px solid var(--ops-orange)',
              borderLeft: '3px solid var(--ops-orange)',
              fontSize: 12,
              color: 'var(--ops-orange)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 700 }}>Case is archived — reopen it first.</span>
            {' '}Click <em>Reopen → Live</em> above to move this case back to active, then you can approve and send the reply.
          </div>
        )}
        {!isArchived && !isApproved && !editing && (
          <>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleApproveSend}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Approve + Send →'}
            </Button>
            {channel === 'email' && (
              <Button variant="secondary" onClick={handleSendAwaitReply} disabled={busy}>
                Send & Await Reply
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
              Edit
            </Button>
          </>
        )}
        {!isArchived && !isApproved && editing && (
          <>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleApproveSend}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Save + Send →'}
            </Button>
            <Button variant="secondary" onClick={handleSaveEdits} disabled={busy || !dirty}>
              Save draft
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setSubject(draft.email_subject ?? '');
                setBody(draft.email_body ?? '');
                setVoice(draft.voice_text ?? '');
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </>
        )}
        {isApproved && (
          <div style={{ fontSize: 11, color: 'var(--ops-fg-3)', padding: '6px 0' }}>
            ✓ Approved {draft.approved_by ? `by ${draft.approved_by}` : ''} ·
            {draft.approved_at ? ` ${new Date(draft.approved_at).toLocaleString()}` : ''}
          </div>
        )}
      </div>

      {draft.internal_summary && (
        <div
          style={{
            marginTop: 16,
            fontSize: 12,
            color: 'var(--ops-fg-2)',
            lineHeight: 1.55,
            padding: 12,
            background: 'var(--ops-panel-2)',
            border: '1px solid var(--ops-line)',
            borderLeft: '3px solid var(--ops-yellow)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--ops-fg-3)',
              marginBottom: 4,
            }}
          >
            Internal summary (not sent)
          </div>
          {draft.internal_summary}
        </div>
      )}
    </>
  );
}

function editorStyle(): React.CSSProperties {
  return {
    width: '100%',
    background: 'var(--ops-bg)',
    color: 'var(--ops-fg)',
    border: '1px solid var(--ops-line-2)',
    padding: '8px 10px',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    lineHeight: 1.55,
    outline: 'none',
    resize: 'vertical',
  };
}
