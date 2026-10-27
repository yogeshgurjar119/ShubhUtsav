import { Router } from 'express';
import { analyzeDate } from '../domain/calendar.js';
import { createPlan } from '../domain/planner.js';
import { cardArtRequestSchema, chatRequestSchema, makeEventInputSchema } from '../domain/schemas.js';
import { answerChat, generateIdeas } from '../services/assistant.js';
import { buildCardArtPrompt } from '../services/cardArt.js';
import { LlmError } from '../services/nvidia.js';
import { HttpError, asyncHandler, parseOrThrow } from './errors.js';
import { createExploreRouter } from './explore.js';

const health = (deps) => (req, res) => {
  const { llm, imageClient, calendar, calendarific, ticketmaster, clock } = deps;
  res.json({
    status: 'ok',
    // The server's own date, so the browser's date pickers agree with the server's timezone.
    today: clock(),
    ai: llm.available,
    image: imageClient.available,
    calendar: calendar.available,
    explore: { festivals: calendarific.available, events: ticketmaster.available },
  });
};

const plan = ({ llm, calendar, clock, logger }) =>
  asyncHandler(async (req, res) => {
    const today = clock();
    const input = parseOrThrow(makeEventInputSchema(today), req.body);
    const created = createPlan(input, today);
    // Independent network calls run side by side; neither can fail the request.
    const [ideas, events] = await Promise.all([
      generateIdeas({ llm, input, plan: created, logger }),
      calendar.getEvents(),
    ]);
    res.json({ plan: created, ideas, dateInsights: analyzeDate({ eventDate: input.eventDate, events }) });
  });

const chat = ({ llm, clock, logger }) =>
  asyncHandler(async (req, res) => {
    const today = clock();
    const { event, messages } = parseOrThrow(chatRequestSchema, req.body);
    const input = parseOrThrow(makeEventInputSchema(today), event);
    if (messages.at(-1).role !== 'user') {
      throw new HttpError(400, 'validation_error', 'The last message must come from the user');
    }
    if (!llm.available) throw new HttpError(503, 'ai_unavailable', 'The assistant is not available right now');

    try {
      const reply = await answerChat({ llm, input, plan: createPlan(input, today), messages });
      res.json({ reply });
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      logger.warn(`Chat failed: ${error.message}`);
      throw new HttpError(502, 'ai_unavailable', 'The assistant could not answer. Please try again.');
    }
  });

/** Turns an image-service failure into a short message the person can act on. */
function cardArtError(error) {
  if (error.kind === 'blocked') {
    return new HttpError(422, 'image_blocked', 'The image safety filter blocked that theme. Try a different theme.');
  }
  if (error.kind === 'timeout') {
    return new HttpError(504, 'image_timeout', 'Card art is taking too long right now. Please try again in a moment.');
  }
  return new HttpError(502, 'image_unavailable', 'Could not create the card art. Please try again.');
}

const cardArt = ({ imageClient, clock, logger }) =>
  asyncHandler(async (req, res) => {
    const { event, theme } = parseOrThrow(cardArtRequestSchema, req.body);
    const input = parseOrThrow(makeEventInputSchema(clock()), event);
    if (!imageClient.available) throw new HttpError(503, 'image_unavailable', 'Card art is not available right now');

    try {
      const image = await imageClient.generate({ prompt: buildCardArtPrompt({ eventType: input.eventType, theme }) });
      res.json({ image });
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      logger.warn(`Card art failed: ${error.message}`);
      throw cardArtError(error);
    }
  });

/**
 * API routes. Dependencies are injected so tests can swap the AI clients, calendar and clock.
 * The limiters guard endpoints that call paid services.
 */
export function createApiRouter({ aiLimiter, imageLimiter, exploreLimiter, ...deps }) {
  const router = Router();

  router.get('/health', health(deps));
  router.post('/plan', aiLimiter, plan(deps));
  router.post('/chat', aiLimiter, chat(deps));
  router.post('/card-art', imageLimiter, cardArt(deps));
  router.use('/explore', createExploreRouter({ ...deps, limiter: exploreLimiter }));

  router.use((req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Unknown API route' } });
  });

  return router;
}
