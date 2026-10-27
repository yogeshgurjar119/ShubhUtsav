import { EVENT_CATEGORIES, normalizeEvents } from '../domain/explore.js';
import { UpstreamError, createCache, fetchJson } from './upstream.js';

const PAGE_SIZE = 24;

/**
 * Ticketmaster Discovery API: live events by country, city, keyword and date range
 * (https://developer.ticketmaster.com). Results are cached for ten minutes per query.
 */
export function createTicketmasterService({
  apiKey,
  baseUrl,
  timeoutMs = 10000,
  ttlMs = 10 * 60 * 1000,
  fetchImpl = globalThis.fetch,
  now,
}) {
  const cache = createCache({ ttlMs, maxEntries: 200, now });

  return {
    available: Boolean(apiKey),

    /** Resolves to a list of event cards, soonest first. */
    async searchEvents({ country, city, keyword, category, from, to }) {
      if (!apiKey) throw new UpstreamError('Ticketmaster is not configured');
      const key = JSON.stringify([country, city, keyword, category, from, to]);

      return cache.getOrLoad(key, async () => {
        const params = new URLSearchParams({
          apikey: apiKey,
          countryCode: country,
          startDateTime: `${from}T00:00:00Z`,
          endDateTime: `${to}T23:59:59Z`,
          size: String(PAGE_SIZE),
          sort: 'date,asc',
        });
        if (city) params.set('city', city);
        if (keyword) params.set('keyword', keyword);
        if (category) params.set('classificationName', EVENT_CATEGORIES[category]);

        const url = new URL(`${baseUrl}/events.json`);
        url.search = params.toString();
        return normalizeEvents(await fetchJson(fetchImpl, url, { timeoutMs, label: 'Ticketmaster' }));
      });
    },
  };
}
