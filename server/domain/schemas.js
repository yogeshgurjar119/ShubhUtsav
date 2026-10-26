import { z } from 'zod';
import { CITY_TIERS, DIETS, EVENT_TYPES, PRIORITY_CATEGORIES, VENUE_TYPES } from './catalog.js';
import { addDays, diffDays, isValidIsoDate } from './dates.js';

const MAX_DAYS_AHEAD = 365 * 3;
const MAX_PRIVATE_GUESTS = 5000;

// Strip control characters (keeping tab and newline) so they never reach logs or prompts.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const stripControls = (s) => s.replace(CONTROL_CHARS, '').trim();
const cleanText = (max) => z.string().transform(stripControls).pipe(z.string().max(max));

/**
 * Builds the event-input schema. `today` (YYYY-MM-DD) is injected so date rules are testable.
 * Unknown keys are rejected instead of silently ignored.
 */
export function makeEventInputSchema(today) {
  return z
    .strictObject({
      eventType: z.enum(EVENT_TYPES),
      guests: z.number().int().min(2).max(50_000),
      budget: z.number().int().min(5000).max(100_000_000),
      eventDate: z.string().refine(isValidIsoDate, 'Use a real date in YYYY-MM-DD format'),
      cityTier: z.enum(CITY_TIERS).default('tier2'),
      venueType: z.enum(VENUE_TYPES).default('hall'),
      dietary: z.enum(DIETS).default('mixed'),
      priorities: z
        .array(z.enum(PRIORITY_CATEGORIES))
        .max(3)
        .default([])
        .refine((list) => new Set(list).size === list.length, 'Priorities must be unique'),
      notes: cleanText(500).default(''),
    })
    .superRefine((input, ctx) => {
      if (input.eventType !== 'public' && input.guests > MAX_PRIVATE_GUESTS) {
        ctx.addIssue({ code: 'custom', path: ['guests'], message: `Up to ${MAX_PRIVATE_GUESTS} guests for this event type` });
      }
      if (input.eventType === 'public' && input.venueType === 'home') {
        ctx.addIssue({ code: 'custom', path: ['venueType'], message: 'A public event needs a hall or an outdoor ground' });
      }
      if (!isValidIsoDate(input.eventDate)) return;
      const days = diffDays(today, input.eventDate);
      if (days < 0) {
        ctx.addIssue({ code: 'custom', path: ['eventDate'], message: 'The event date cannot be in the past' });
      } else if (days > MAX_DAYS_AHEAD) {
        ctx.addIssue({
          code: 'custom',
          path: ['eventDate'],
          message: `Plan at most 3 years ahead (up to ${addDays(today, MAX_DAYS_AHEAD)})`,
        });
      }
    });
}

export const chatRequestSchema = z.strictObject({
  event: z.unknown(), // validated separately with makeEventInputSchema(today)
  messages: z
    .array(
      z.strictObject({
        role: z.enum(['user', 'assistant']),
        content: cleanText(1000).pipe(z.string().min(1)),
      }),
    )
    .min(1)
    .max(12),
});

export const cardArtRequestSchema = z.strictObject({
  event: z.unknown(), // validated separately with makeEventInputSchema(today)
  theme: cleanText(80).optional(),
});

/** Shape required from the model for the ideas section. Every string is length-capped. */
const text = (max) => z.string().transform(stripControls).pipe(z.string().min(1).max(max));
export const aiIdeasSchema = z.object({
  themes: z.array(z.object({ title: text(80), description: text(240) })).min(1).max(5),
  menu: z.array(text(120)).min(1).max(8),
  entertainment: z.array(text(120)).min(1).max(6),
  budgetTips: z.array(text(200)).min(1).max(6),
  personalTouch: text(300).optional(),
});
