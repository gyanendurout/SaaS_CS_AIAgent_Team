import Link from 'next/link';

/**
 * Landing page — three big channel cards.
 *
 * Each card links to its dedicated route (/call, /email, /web). The cards
 * intentionally use simple inline glyphs (no icon library) to keep this app
 * dependency-light.
 */

const CHANNELS = [
  {
    href: '/call',
    eyebrow: 'Fastest',
    title: 'Call us',
    description: 'Talk to our AI assistant right in your browser — no phone needed.',
    glyph: '☎',
  },
  {
    href: '/email',
    eyebrow: 'Async',
    title: 'Send an email',
    description: 'Write us a note. JOOLA AI reads it, replies, and tracks the conversation.',
    glyph: '✉',
  },
  {
    href: '/web',
    eyebrow: 'Structured',
    title: 'Open a case',
    description: 'Fill out a quick form for warranty claims, returns, and product issues.',
    glyph: '▤',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="mb-10 text-center">
        <p className="m-0 font-sans text-xs font-bold uppercase tracking-mega text-joola-stone">
          Welcome to JOOLA Support
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-3xl uppercase leading-[1.05] tracking-tight text-joola-black sm:text-4xl">
          How would you like to contact us?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-md text-joola-graphite">
          Choose a channel and JOOLA's AI customer service will pick it up immediately — warranty
          claims, returns, NFC registration, you name it.
        </p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="group flex h-full flex-col rounded border border-joola-fog bg-white p-6 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:border-joola-black hover:shadow-md"
            >
              <span
                aria-hidden
                className="mb-5 grid h-14 w-14 place-items-center rounded-sm bg-joola-yellow font-display text-2xl text-joola-black transition-colors group-hover:bg-joola-yellow-deep"
              >
                {c.glyph}
              </span>
              <span className="font-sans text-xs font-bold uppercase tracking-mega text-joola-stone">
                {c.eyebrow}
              </span>
              <span className="mt-1 font-display text-xl uppercase tracking-tight text-joola-black">
                {c.title}
              </span>
              <span className="mt-2 text-sm text-joola-graphite">{c.description}</span>
              <span className="mt-auto pt-5 font-mono text-[11px] uppercase tracking-mega text-joola-graphite group-hover:text-joola-black">
                Continue →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-center text-xs text-joola-stone">
        Hours: Monday–Friday, 8AM–5PM EST. Voice is available 24/7 with AI.
      </p>
    </main>
  );
}
