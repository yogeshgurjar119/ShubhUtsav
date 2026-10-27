import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { todayIn } from './domain/dates.js';
import { createApiRouter } from './http/api.js';
import { CSP_DIRECTIVES } from './http/csp.js';
import { errorMiddleware } from './http/errors.js';
import { noStore, permissionsPolicy, requireJson } from './http/security.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const limiter = (max, windowMs) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment.' } });
    },
  });

/**
 * Builds the Express app. Everything environment-specific is injected:
 *  - `llm`: object with `available` and `complete()` (the NVIDIA client, or a fake in tests)
 *  - `imageClient`: object with `available` and `generate()`
 *  - `calendar`: object with `available` and `getEvents()` (the keyless holiday feed)
 *  - `calendarific`: object with `available` and `getHolidays()`
 *  - `ticketmaster`: object with `available` and `searchEvents()`
 *  - `clock`: returns today's date as YYYY-MM-DD
 */
export function createApp({
  config,
  llm,
  imageClient,
  calendar,
  calendarific,
  ticketmaster,
  clock = () => todayIn(config.timezone),
  logger = console,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: { ...CSP_DIRECTIVES } } }));

  app.use(permissionsPolicy);

  const { windowMs, apiMax, aiMax, imageMax, exploreMax } = config.rateLimit;
  app.use(
    '/api',
    noStore,
    limiter(apiMax, windowMs),
    requireJson,
    express.json({ limit: '16kb' }),
    createApiRouter({
      llm,
      imageClient,
      calendar,
      calendarific,
      ticketmaster,
      clock,
      logger,
      aiLimiter: limiter(aiMax, windowMs),
      imageLimiter: limiter(imageMax, windowMs),
      exploreLimiter: limiter(exploreMax, windowMs),
    }),
  );

  // `no-cache` means "revalidate every time": small files, always the current version after a deploy.
  app.use(express.static(PUBLIC_DIR, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  app.use(errorMiddleware(logger));
  return app;
}
