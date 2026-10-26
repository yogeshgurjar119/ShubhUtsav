/**
 * Minimal client for NVIDIA's OpenAI-compatible chat-completions API.
 * The API key stays on the server; errors never include the key or the upstream body.
 */
export class LlmError extends Error {
  constructor(message, { retryable = false, status, kind = 'unavailable' } = {}) {
    super(message);
    this.name = 'LlmError';
    this.retryable = retryable;
    this.status = status;
    this.kind = kind; // 'unavailable' | 'timeout' | 'blocked', so callers can show a useful message
  }
}

// NVIDIA retires hosted models from time to time and then answers 404 or 410 for them.
const MODEL_GONE = new Set([404, 410]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `models` is an ordered list (or a single `model` string). If the first one has been retired,
 * the next is tried, and the one that works is remembered for later requests.
 */
export function createNvidiaClient({
  apiKey,
  models,
  model,
  baseUrl,
  timeoutMs = 20000,
  retries = 1,
  retryDelayMs = 300,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  const modelList = [models ?? model].flat().filter(Boolean);
  let preferred = 0;

  async function requestOnce(body) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new LlmError(timedOut ? 'The AI service timed out' : 'Could not reach the AI service', { retryable: true });
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

  async function withRetries(body) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await requestOnce(body);
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

      let lastGone;
      for (let step = 0; step < modelList.length; step += 1) {
        const index = (preferred + step) % modelList.length;
        const body = {
          model: modelList[index],
          messages: [{ role: 'system', content: system }, ...messages],
          temperature,
          top_p: 0.9,
          max_tokens: maxTokens,
          stream: false,
        };
        try {
          const text = await withRetries(body);
          preferred = index;
          return text;
        } catch (error) {
          if (!(error instanceof LlmError) || !MODEL_GONE.has(error.status)) throw error;
          lastGone = error;
          logger.warn(`AI model "${modelList[index]}" is no longer available (status ${error.status}); trying the next one`);
        }
      }
      throw new LlmError(
        `None of the configured AI models is available (status ${lastGone.status}). Set NVIDIA_MODEL to a current model.`,
        { status: lastGone.status },
      );
    },
  };
}
