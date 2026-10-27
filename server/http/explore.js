import { Router } from 'express';
import { COUNTRIES, makeEventsQuerySchema, makeFestivalQuerySchema } from '../domain/explore.js';
import { UpstreamError } from '../services/upstream.js';
import { HttpError, asyncHandler, parseOrThrow } from './errors.js';

/** Runs an upstream call and turns its failure into a generic 502 (details go to the log only). */
async function upstream(call, logger, what) {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    logger.warn(`${what} failed: ${error.message}`);
    throw new HttpError(502, 'upstream_unavailable', `${what} could not be loaded right now. Please try again later.`);
  }
}

/**
 * "Explore" endpoints: festivals and holidays (Calendarific) and live events (Ticketmaster).
 * Both are read-only GETs with strictly validated query strings.
 */
export function createExploreRouter({ calendarific, ticketmaster, clock, logger, limiter }) {
  const router = Router();
  router.use(limiter);

  router.get('/countries', (req, res) => {
    res.json({ countries: COUNTRIES });
  });

  router.get(
    '/festivals',
    asyncHandler(async (req, res) => {
      const query = parseOrThrow(makeFestivalQuerySchema(clock()), req.query);
      if (!calendarific.available) {
        throw new HttpError(503, 'explore_unavailable', 'Festival data is not set up on this server');
      }

      const all = await upstream(() => calendarific.getHolidays(query), logger, 'Festival data');
      const holidays = query.month ? all.filter((h) => Number(h.date.slice(5, 7)) === query.month) : all;
      res.json({ country: query.country, year: query.year, month: query.month ?? null, holidays });
    }),
  );

  router.get(
    '/events',
    asyncHandler(async (req, res) => {
      const query = parseOrThrow(makeEventsQuerySchema(clock()), req.query);
      if (!ticketmaster.available) {
        throw new HttpError(503, 'explore_unavailable', 'Event listings are not set up on this server');
      }

      const events = await upstream(() => ticketmaster.searchEvents(query), logger, 'Event listings');
      res.json({ country: query.country, from: query.from, to: query.to, events });
    }),
  );

  return router;
}
