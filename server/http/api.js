import { Router } from 'express';
import { analyzeDate } from '../domain/calendar.js';
import { createPlan } from '../domain/planner.js';
import { cardArtRequestSchema, chatRequestSchema, makeEventInputSchema } from '../domain/schemas.js';
import { answerChat, generateIdeas } from '../services/assistant.js';
import { buildCardArtPrompt } from '../services/cardArt.js';
import { LlmError } from '../services/nvidia.js';
import { HttpError, asyncHandler, parseOrThrow } from './errors.js';
import { createExploreRouter } from './explore.js';

/**
 * API routes. Dependencies are injected so tests can swap the AI clients, calendar and clock.
 * The limiters guard endpoints that call paid services.
 */
export function createApiRouter({ llm, imageClient, calendar, calendarific, ticketmaster, clock, logger, aiLimiter, imageLimiter, exploreLimiter }) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      ai: llm.available,
      image: imageClient.available,
      calendar: calendar.available,
      explore: { festivals: calendarific.available, events: ticketmaster.available },
    });
  });

  router.post(
    '/plan',
    aiLimiter,
    asyncHandler(async (req, res) => {
      const today = clock();
      const input = parseOrThrow(makeEventInputSchema(today), req.body);
      const plan = createPlan(input, today);
      // Independent network calls run side by side; neither can fail the request.
      const [ideas, events] = await Promise.all([generateIdeas({ llm, input, plan, logger }), calendar.getEvents()]);
      const dateInsights = analyzeDate({ eventDate: input.eventDate, events });
      res.json({ plan, ideas, dateInsights });
    }),
  );

  router.post(
    '/chat',
    aiLimiter,
    asyncHandler(async (req, res) => {
      const today = clock();
      const { event, messages } = parseOrThrow(chatRequestSchema, req.body);
      const input = parseOrThrow(makeEventInputSchema(today), event);
      if (messages.at(-1).role !== 'user') {
        throw new HttpError(400, 'validation_error', 'The last message must come from the user');
      }
      if (!llm.available) {
        throw new HttpError(503, 'ai_unavailable', 'The assistant is not available right now');
      }

      const plan = createPlan(input, today);
      try {
        const reply = await answerChat({ llm, input, plan, messages });
        res.json({ reply });
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        logger.warn(`Chat failed: ${error.message}`);
        throw new HttpError(502, 'ai_unavailable', 'The assistant could not answer. Please try again.');
      }
    }),
  );

  router.post(
    '/card-art',
    imageLimiter,
    asyncHandler(async (req, res) => {
      const { event, theme } = parseOrThrow(cardArtRequestSchema, req.body);
      const input = parseOrThrow(makeEventInputSchema(clock()), event);
      if (!imageClient.available) {
        throw new HttpError(503, 'image_unavailable', 'Card art is not available right now');
      }

      try {
        const image = await imageClient.generate({ prompt: buildCardArtPrompt({ eventType: input.eventType, theme }) });
        res.json({ image });
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        logger.warn(`Card art failed: ${error.message}`);
        if (error.kind === 'blocked') {
          throw new HttpError(422, 'image_blocked', 'The image safety filter blocked that theme. Try a different theme.');
        }
        if (error.kind === 'timeout') {
          throw new HttpError(504, 'image_timeout', 'Card art is taking too long right now. Please try again in a moment.');
        }
        throw new HttpError(502, 'image_unavailable', 'Could not create the card art. Please try again.');
      }
    }),
  );

  router.use('/explore', createExploreRouter({ calendarific, ticketmaster, clock, logger, limiter: exploreLimiter }));

  router.use((req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Unknown API route' } });
  });

  return router;
}
