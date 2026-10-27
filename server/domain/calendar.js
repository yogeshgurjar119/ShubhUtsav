import { diffDays, isValidIsoDate } from './dates.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const MAX_NAME = 80;
const MAX_NEARBY = 8;

/** Undoes iCalendar text escaping and removes anything unprintable. The feed is third-party data. */
const cleanIcsText = (raw = '') =>
  raw
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .replace(CONTROL_CHARS, '')
    .trim()
    .slice(0, MAX_NAME);

/**
 * Parses an iCalendar (.ics) feed of holidays into `{ date, name, kind, tentative }`.
 * Only all-day events with a real date are kept; malformed entries are skipped.
 */
export function parseIcs(text) {
  const unfolded = String(text).replace(/\r?\n[ \t]/g, '');
  const seen = new Set();
  const events = [];

  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const start = /^DTSTART(?:;[^:\r\n]*)?:(\d{4})(\d{2})(\d{2})\s*$/m.exec(block);
    const summary = /^SUMMARY:(.*)$/m.exec(block);
    if (!start || !summary) continue;

    const date = `${start[1]}-${start[2]}-${start[3]}`;
    const name = cleanIcsText(summary[1]);
    if (!name || !isValidIsoDate(date)) continue;

    const description = /^DESCRIPTION:(.*)$/m.exec(block)?.[1] ?? '';
    const key = `${date}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      date,
      name,
      kind: /public holiday/i.test(description) ? 'public' : 'observance',
      tentative: /tentative/i.test(`${summary[1]} ${description}`),
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/**
 * What is special about the chosen date? Looks at holidays and festivals within
 * `windowDays` and turns them into practical booking advice. Pure function.
 */
export function analyzeDate({ eventDate, events, windowDays = 7 }) {
  const day = new Date(`${eventDate}T00:00:00Z`).getUTCDay();
  const weekday = WEEKDAYS[day];
  const isWeekend = day === 0 || day === 6;

  const nearby = events
    .map((e) => ({ ...e, offset: diffDays(eventDate, e.date) }))
    .filter((e) => Math.abs(e.offset) <= windowDays)
    .sort(
      (a, b) =>
        Math.abs(a.offset) - Math.abs(b.offset) || (a.kind === 'public' ? -1 : 1) - (b.kind === 'public' ? -1 : 1),
    )
    .slice(0, MAX_NEARBY);

  const advice = [];
  const sameDay = nearby.filter((e) => e.offset === 0);
  const closePublic = nearby.filter((e) => e.kind === 'public' && e.offset !== 0 && Math.abs(e.offset) <= 3);

  if (sameDay.length > 0) {
    const names = sameDay.map((e) => e.name).join(', ');
    advice.push(
      `Your date falls on ${names}. Popular vendors fill up early on festival dates and may charge a premium, so book as soon as you can.`,
    );
  }
  if (closePublic.length > 0) {
    const names = closePublic.map((e) => e.name).join(', ');
    advice.push(`${names} falls within three days. Guests may be travelling, so arrange stay and transport early.`);
  }
  if (isWeekend && sameDay.length === 0) {
    advice.push(`${weekday} is a high-demand day. Ask vendors if a Friday or weekday date would get you better rates.`);
  } else if (!isWeekend && nearby.length === 0) {
    advice.push(`${weekday} is usually easier to book and often cheaper, but fewer guests may be able to attend.`);
  }
  if (nearby.some((e) => e.tentative)) {
    advice.push('Some festival dates are tentative and depend on moon sighting. Confirm them closer to the date.');
  }

  return { weekday, isWeekend, nearby, advice };
}
