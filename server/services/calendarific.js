import { normalizeHolidays } from '../domain/explore.js';
import { UpstreamError, createCache, fetchJson } from './upstream.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calendarific: holidays and festivals by country (https://calendarific.com).
 * The free plan is limited to about 500 calls a month, so a whole year is fetched once per
 * country and cached for a day; month filtering happens here, not upstream.
 */
export function createCalendarificService({
  apiKey,
  baseUrl,
  timeoutMs = 10000,
  ttlMs = DAY_MS,
  fetchImpl = globalThis.fetch,
  now,
}) {
  const cache = createCache({ ttlMs, maxEntries: 50, now });

  return {
    available: Boolean(apiKey),

    /** Resolves to `[{ date, name, description, types }]` for the country and year. */
    async getHolidays({ country, year }) {
      if (!apiKey) throw new UpstreamError('Calendarific is not configured');
      return cache.getOrLoad(`${country}:${year}`, async () => {
        const url = new URL(`${baseUrl}/holidays`);
        url.search = new URLSearchParams({ api_key: apiKey, country, year: String(year) }).toString();
        const payload = await fetchJson(fetchImpl, url, { timeoutMs, label: 'Calendarific' });
        const code = payload?.meta?.code;
        if (code !== undefined && code !== 200) {
          throw new UpstreamError(`Calendarific returned status ${code}`, { status: code });
        }
        return normalizeHolidays(payload);
      });
    },
  };
}
