import { fallbackIdeas } from '../domain/ideaBank.js';
import { aiIdeasSchema } from '../domain/schemas.js';
import { buildChatPrompt, buildIdeasPrompt } from './prompts.js';

/** Pulls the first JSON object out of a model reply (tolerates code fences and chatter). */
export function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Personalised ideas from the AI, validated against a strict schema.
 * Any failure (no key, timeout, bad JSON, wrong shape) falls back to the built-in idea bank,
 * so the plan itself is never blocked by the AI.
 */
export async function generateIdeas({ llm, input, plan, logger = console }) {
  const fallback = { source: 'builtin', ...fallbackIdeas(input) };
  if (!llm.available) return fallback;

  try {
    const { system, messages } = buildIdeasPrompt(input, plan);
    const reply = await llm.complete({ system, messages, temperature: 0.8, maxTokens: 1400 });
    const parsed = aiIdeasSchema.safeParse(extractJson(reply));
    if (!parsed.success) {
      logger.warn('AI ideas rejected: reply did not match the expected shape');
      return fallback;
    }
    return { source: 'ai', ...parsed.data };
  } catch (error) {
    logger.warn(`AI ideas unavailable: ${error.message}`);
    return fallback;
  }
}

/** Answers a chat turn using the plan as grounding. Errors propagate to the caller. */
export async function answerChat({ llm, input, plan, messages }) {
  const { system, messages: turns } = buildChatPrompt(input, plan, messages);
  const reply = await llm.complete({ system, messages: turns, temperature: 0.5, maxTokens: 500 });
  return reply.trim();
}
