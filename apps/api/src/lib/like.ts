/**
 * Escape `%`, `_` and backslash so a value is matched literally by Postgres ILIKE
 * (case-insensitive equality). Without it "a_b@x.com" also matches "axb@x.com",
 * and "%" matches every row (QA 2026-11-14, D1 critical).
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}
