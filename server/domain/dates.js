// Date helpers that work on plain "YYYY-MM-DD" strings in UTC, so results never
// depend on the server's timezone or daylight-saving rules.

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value) {
  const m = ISO_DATE.exec(value ?? '');
  if (!m) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

const toUtc = (iso) => new Date(`${iso}T00:00:00Z`);

export function addDays(iso, days) {
  return new Date(toUtc(iso).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function diffDays(fromIso, toIso) {
  return Math.round((toUtc(toIso).getTime() - toUtc(fromIso).getTime()) / MS_PER_DAY);
}

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayIn(timezone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
