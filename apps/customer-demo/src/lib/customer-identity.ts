/**
 * Customer identity — the "play as" customer for the demo.
 *
 * The dashboard side is read-only; this app is the customer side. To exercise
 * different policy paths (NFC paddle, eBay buyer, signed-for damaged table)
 * the CS Lead needs to switch which customer they are. We persist that choice
 * in localStorage and load the seeded customer list from the `customers` table.
 *
 * Falls back to a small hard-coded list if the customers table is empty
 * (so the demo always has something usable even before seed migrations run).
 */

export type CustomerIdentity = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  /** True if this identity came from the database rather than the fallback list. */
  fromDb?: boolean;
};

const STORAGE_KEY = 'joola.customer-demo.customer-id';

/** Seeded customers we know exist in migration 0002. Used as a fallback. */
export const FALLBACK_CUSTOMERS: CustomerIdentity[] = [
  {
    id: 'fallback-sarah',
    name: 'Sarah Patel',
    email: 'sarah.patel@example.com',
    phone: '+1-555-0101',
    country: 'US',
  },
  {
    id: 'fallback-marcus',
    name: 'Marcus Yen',
    email: 'marcus.yen@example.com',
    phone: '+1-555-0102',
    country: 'US',
  },
  {
    id: 'fallback-alex',
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    phone: '+1-555-0103',
    country: 'US',
  },
];

export function readSelectedCustomerId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSelectedCustomerId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore — private mode / quota
  }
}

/** Choose the default customer when no preference has been saved yet. */
export function chooseDefault(list: CustomerIdentity[]): CustomerIdentity | null {
  if (list.length === 0) return null;
  const sarah = list.find((c) => c.name.toLowerCase().includes('sarah'));
  return sarah ?? list[0] ?? null;
}
