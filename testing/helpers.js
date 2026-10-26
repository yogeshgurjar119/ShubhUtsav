import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { UpstreamError } from '../server/services/upstream.js';

export const TODAY = '2026-10-26';

// A valid 1x1 PNG, as base64.
export const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const silentLogger = { warn() {}, error() {}, log() {} };

export const validEvent = (overrides = {}) => ({
  eventType: 'wedding',
  guests: 200,
  budget: 1_200_000,
  eventDate: '2027-06-20',
  cityTier: 'tier2',
  venueType: 'hall',
  dietary: 'veg',
  priorities: ['catering', 'decor'],
  notes: '',
  ...overrides,
});

/** A fake AI client. `reply` may be a string or a function returning/throwing. */
export function fakeLlm(reply = '{}', { available = true } = {}) {
  const calls = [];
  return {
    available,
    calls,
    async complete(args) {
      calls.push(args);
      return typeof reply === 'function' ? reply(args) : reply;
    },
  };
}

/** A fake image client. `result` may be an object or a function returning/throwing. */
export function fakeImage(result = { mime: 'image/png', data: TINY_PNG }, { available = true } = {}) {
  const calls = [];
  return {
    available,
    calls,
    async generate(args) {
      calls.push(args);
      return typeof result === 'function' ? result(args) : result;
    },
  };
}

/** A fake holiday calendar returning fixed events. */
export function fakeCalendar(events = [], { available = true } = {}) {
  return {
    available,
    async getEvents() {
      return events;
    },
  };
}

/** Fake Calendarific service returning fixed holidays. */
export function fakeCalendarific(holidays = [], { available = true, fail = false } = {}) {
  const calls = [];
  return {
    available,
    calls,
    async getHolidays(args) {
      calls.push(args);
      if (fail) throw new UpstreamError('Calendarific returned status 500');
      return holidays;
    },
  };
}

/** Fake Ticketmaster service returning fixed events. */
export function fakeTicketmaster(events = [], { available = true, fail = false } = {}) {
  const calls = [];
  return {
    available,
    calls,
    async searchEvents(args) {
      calls.push(args);
      if (fail) throw new UpstreamError('Ticketmaster returned status 500');
      return events;
    },
  };
}

/** Starts the app on a random port. Returns a tiny JSON client and a `close()`. */
export async function startServer({
  llm = fakeLlm(),
  imageClient = fakeImage(),
  calendar = fakeCalendar(),
  calendarific = fakeCalendarific(),
  ticketmaster = fakeTicketmaster(),
  env = {},
} = {}) {
  const config = loadConfig({ RATE_LIMIT_AI_PER_MIN: '1000', RATE_LIMIT_IMAGE_PER_MIN: '1000', RATE_LIMIT_EXPLORE_PER_MIN: '1000', ...env });
  const app = createApp({ config, llm, imageClient, calendar, calendarific, ticketmaster, clock: () => TODAY, logger: silentLogger });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    async request(path, { method = 'GET', body, headers = {}, raw } = {}) {
      const res = await fetch(base + path, {
        method,
        headers: body !== undefined && raw === undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
        body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* not JSON (static file) */
      }
      return { status: res.status, headers: res.headers, json, text };
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
