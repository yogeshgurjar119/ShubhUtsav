import { LlmError } from './llmError.js';

const AUTH_STATUSES = new Set([401, 403]);

/**
 * Is this failure about the model (retired, hanging, overloaded, bad answer) rather than about us?
 * Bad credentials and safety-filter refusals would be the same for every model, so they are final.
 */
export function isModelProblem(error) {
  return error instanceof LlmError && error.kind !== 'blocked' && !AUTH_STATUSES.has(error.status);
}

/**
 * Tries an ordered list of models until one works, remembering the one that did.
 * A total time budget keeps the whole chain under the hosting platform's request limit.
 */
export function createModelFallback(models, { now = () => Date.now() } = {}) {
  let preferred = 0;

  return {
    /**
     * `attempt(model, { timeoutMs })` does one call. Failures for which `shouldSkip(error)` is true
     * move on to the next model; anything else is thrown at once. `onSkip(model, error)` is for logging.
     */
    async run(attempt, { shouldSkip = isModelProblem, onSkip = () => {}, perAttemptMs, totalMs }) {
      const started = now();
      let lastError = null;

      for (let step = 0; step < models.length; step += 1) {
        const remaining = totalMs - (now() - started);
        if (remaining <= 0) break;

        const index = (preferred + step) % models.length;
        try {
          const result = await attempt(models[index], { timeoutMs: Math.min(perAttemptMs, remaining) });
          preferred = index;
          return result;
        } catch (error) {
          if (!shouldSkip(error)) throw error;
          lastError = error;
          onSkip(models[index], error);
        }
      }
      throw lastError ?? new LlmError('The AI service ran out of time', { kind: 'timeout' });
    },
  };
}
