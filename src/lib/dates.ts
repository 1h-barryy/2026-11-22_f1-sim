// Date helpers. All dates are YYYY-MM-DD strings in the phone's local time zone.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parse YYYY-MM-DD as a local-midnight Date (NOT UTC). Returns null if the
 * string is malformed or not a real calendar date (e.g. 2026-02-31).
 */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

/** True for a YYYY-MM-DD string that is a real calendar date. */
export function isValidISODate(value: unknown): value is string {
  return typeof value === 'string' && parseISODate(value) !== null;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Shift a YYYY-MM-DD date by whole days (local calendar). */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function tomorrowISO(today: string = todayISO()): string {
  return addDaysISO(today, 1);
}

export function yesterdayISO(today: string = todayISO()): string {
  return addDaysISO(today, -1);
}

/**
 * "Today" / "Tomorrow" / "Yesterday" / short date like "Mon, Nov 24".
 * Pass `today` (from useToday) so labels refresh at midnight.
 */
export function formatRelativeDay(iso: string, today: string = todayISO()): string {
  if (iso === today) return 'Today';
  if (iso === tomorrowISO(today)) return 'Tomorrow';
  if (iso === yesterdayISO(today)) return 'Yesterday';
  const d = parseISODate(iso);
  if (!d) return iso;
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** True if the date is strictly before today. ISO date strings compare lexically. */
export function isOverdue(iso: string | null, today: string = todayISO()): boolean {
  if (!iso) return false;
  return iso < today;
}

/** IANA time zone of the device, e.g. "America/New_York". */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
