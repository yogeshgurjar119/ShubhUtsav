import { parseIcs } from '../domain/calendar.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FEED_CHARS = 3_000_000;

/**
 * Loads the public India holiday and festival calendar (iCalendar feed, no API key needed).
 * The result is cached for a day, concurrent requests share one download, and any failure
 * returns an empty list so the plan itself never depends on this third-party service.
 */
export function createCalendarService({
  url,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
  ttlMs = DAY_MS,
  failureTtlMs = 5 * 60 * 1000,
  now = () => Date.now(),
  logger = console,
}) {
  let cache = { events: [], expiresAt: 0 };
  let inflight = null;

  async function download() {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'text/calendar' } });
    if (!response.ok) throw new Error(`calendar feed returned status ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_FEED_CHARS) throw new Error('calendar feed is unexpectedly large');
    const events = parseIcs(text);
    if (events.length === 0) throw new Error('calendar feed had no usable events');
    return events;
  }

  return {
    available: Boolean(url),

    async getEvents() {
      if (!url) return [];
      if (now() < cache.expiresAt) return cache.events;
      inflight ??= download()
        .then((events) => {
          cache = { events, expiresAt: now() + ttlMs };
        })
        .catch((error) => {
          logger.warn(`Holiday calendar unavailable: ${error.message}`);
          cache = { events: cache.events, expiresAt: now() + failureTtlMs }; // keep stale data if we have any
        })
        .finally(() => {
          inflight = null;
        });
      await inflight;
      return cache.events;
    },
  };
}
