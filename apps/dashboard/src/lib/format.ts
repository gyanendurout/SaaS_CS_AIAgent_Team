/**
 * Display formatters — ports of CS.helpers / CS.fmt* from docs/design/src/data*.js.
 * All helpers accept null/undefined defensively so callers can pass raw DB rows.
 */

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'] as const;

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function fmtTime(d: Date | string | number | null | undefined): string {
  if (d == null) return '--';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '--';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function fmtDateTime(d: Date | string | number | null | undefined): string {
  if (d == null) return '--';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '--';
  const month = MONTHS[date.getMonth()] ?? '';
  return `${pad(date.getDate())} ${month} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fmtDate(d: Date | string | number | null | undefined): string {
  if (d == null) return '--';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '--';
  const month = MONTHS[date.getMonth()] ?? '';
  return `${pad(date.getDate())} ${month}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '--';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** mm:ss for a duration (used by KPI "Avg handle"). */
export function fmtMinSec(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${pad(s)}`;
}

/** Whole-hour clock for the header banner (HH:MM:SS, 24h). */
export function fmtClock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Long date for the header banner ("MON 17 MAY 2026"). */
export function fmtBannerDate(d: Date): string {
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'] as const;
  const day = days[d.getDay()] ?? '';
  const month = MONTHS[d.getMonth()] ?? '';
  return `${day} ${pad(d.getDate())} ${month} ${d.getFullYear()}`;
}
