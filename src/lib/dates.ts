// Date helpers. All dates are YYYY-MM-DD strings in the phone's local time zone.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse YYYY-MM-DD as a local-midnight Date (NOT UTC). Returns null if invalid. */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

/** "Today" / "Tomorrow" / "Yesterday" / short date like "Mon, Nov 24". */
export function formatRelativeDay(iso: string): string {
  if (iso === todayISO()) return 'Today';
  if (iso === tomorrowISO()) return 'Tomorrow';
  if (iso === yesterdayISO()) return 'Yesterday';
  const d = parseISODate(iso);
  if (!d) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** True if the date is strictly before today. ISO date strings compare lexically. */
export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return iso < todayISO();
}

/** IANA time zone of the device, e.g. "America/New_York". */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
