import { LlmError } from './llmError.js';
import { createModelFallback } from './modelFallback.js';

export { LlmError };

// NVIDIA retires hosted models from time to time and then answers 404 or 410 for them.
const MODEL_GONE = new Set([404, 410]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One chat-completions call. Resolves to the reply text; failures are LlmErrors without secrets. */
async function postChat(fetchImpl, { baseUrl, apiKey, body, timeoutMs }) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    // A timeout is not retried: the next model is tried instead, so one slow model cannot eat the time budget.
    throw new LlmError(timedOut ? 'The AI service timed out' : 'Could not reach the AI service', {
      retryable: !timedOut,
      kind: timedOut ? 'timeout' : 'unavailable',
    });
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new LlmError(`The AI service returned status ${response.status}`, { retryable, status: response.status });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new LlmError('The AI service returned an unreadable response');
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new LlmError('The AI service returned an empty answer');
  }
  return content;
}

/** Final error when every model failed: say how to fix retired-model settings. */
function exhaustedError(lastError) {
  if (MODEL_GONE.has(lastError.status)) {
    return new LlmError(
      `None of the configured AI models is available (status ${lastError.status}). Set NVIDIA_MODEL to a current model.`,
      { status: lastError.status },
    );
  }
  return lastError;
}

/**
 * Client for NVIDIA's OpenAI-compatible chat API. `models` is an ordered list (or a single `model`):
 * a model that is retired, slow or failing is skipped in favour of the next, within `totalTimeoutMs`.
 * The API key stays on the server; errors never include the key or the upstream body.
 */
export function createNvidiaClient({
  apiKey,
  models,
  model,
  baseUrl,
  timeoutMs = 20000,
  totalTimeoutMs = 40000,
  retries = 1,
  retryDelayMs = 300,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  const modelList = [models ?? model].flat().filter(Boolean);
  const fallback = createModelFallback(modelList);

  async function withRetries(call) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await call();
      } catch (error) {
        if (!(error instanceof LlmError) || !error.retryable || attempt >= retries) throw error;
        await wait(retryDelayMs * (attempt + 1));
      }
    }
  }

  return {
    available: Boolean(apiKey) && modelList.length > 0,

    /** Sends a system prompt plus conversation and resolves to the model's text. */
    async complete({ system, messages, temperature = 0.6, maxTokens = 1200 }) {
      if (!this.available) throw new LlmError('The AI service is not configured');

      const bodyFor = (modelId) => ({
        model: modelId,
        messages: [{ role: 'system', content: system }, ...messages],
        temperature,
        top_p: 0.9,
        max_tokens: maxTokens,
        stream: false,
      });

      try {
        return await fallback.run(
          (modelId, attempt) =>
            withRetries(() =>
              postChat(fetchImpl, { baseUrl, apiKey, body: bodyFor(modelId), timeoutMs: attempt.timeoutMs }),
            ),
          {
            perAttemptMs: timeoutMs,
            totalMs: totalTimeoutMs,
            onSkip: (modelId, error) =>
              logger.warn(`AI model "${modelId}" skipped (${error.status ?? error.message}); trying the next one`),
          },
        );
      } catch (error) {
        throw error instanceof LlmError ? exhaustedError(error) : error;
      }
    },
  };
}
