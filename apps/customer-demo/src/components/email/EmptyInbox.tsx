export function EmptyInbox({ customerName }: { customerName: string }) {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-sm border border-dashed border-joola-fog bg-joola-paper p-6 text-center">
      <div>
        <p className="m-0 font-display text-md uppercase tracking-tight text-joola-black">
          Inbox is empty
        </p>
        <p className="m-0 mt-1 text-sm text-joola-graphite">
          No messages yet for <strong>{customerName}</strong>.
        </p>
        <p className="m-0 mt-3 text-xs text-joola-stone">
          Send an email to <span className="font-mono">support@joola.com</span> on the right to start
          a conversation.
        </p>
      </div>
    </div>
  );
}
