import { LlmError } from './llmError.js';
import { createModelFallback } from './modelFallback.js';

const MAX_BASE64_CHARS = 8_000_000; // about 6 MB of image
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// Models differ in how many steps they need. Anything not listed uses the fast few-step default.
const MODEL_PARAMS = {
  'black-forest-labs/flux.1-dev': { steps: 28, cfg_scale: 3.5 },
};
const DEFAULT_PARAMS = { steps: 4 };

/** Identifies PNG/JPEG/WebP from the first bytes, so we never forward arbitrary data as an image. */
export function detectMime(base64) {
  const head = Buffer.from(base64.slice(0, 24), 'base64');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (head.length >= 8 && head.subarray(0, 8).equals(png)) return 'image/png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 12 && head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Validates the provider's answer and returns `{ mime, data }`. Anything unexpected is a generic LlmError. */
function parseImage(payload) {
  const artifact = payload?.artifacts?.[0];
  if (artifact?.finishReason === 'CONTENT_FILTERED') {
    throw new LlmError('The image was blocked by the safety filter', { kind: 'blocked' });
  }
  const data = artifact?.base64 ?? payload?.data?.[0]?.b64_json ?? payload?.image;
  if (typeof data !== 'string' || data.length === 0 || data.length > MAX_BASE64_CHARS || !BASE64.test(data)) {
    throw new LlmError('The image service returned no usable image');
  }
  const mime = detectMime(data);
  if (!mime) throw new LlmError('The image service returned an unsupported file');
  return { mime, data };
}

/** One image request to one model. Failures never include the key or the upstream body. */
async function requestImage(fetchImpl, { baseUrl, apiKey, modelId, request, timeoutMs }) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/${modelId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...request, ...(MODEL_PARAMS[modelId] ?? DEFAULT_PARAMS) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new LlmError(timedOut ? 'The image service timed out' : 'Could not reach the image service', {
      retryable: true,
      kind: timedOut ? 'timeout' : 'unavailable',
    });
  }
  if (!response.ok) {
    throw new LlmError(`The image service returned status ${response.status}`, { status: response.status });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new LlmError('The image service returned an unreadable response');
  }
  return parseImage(payload);
}

/**
 * Client for NVIDIA's hosted image models (FLUX). `models` is an ordered list: a model that is
 * retired, hangs or errors is skipped in favour of the next, within `totalTimeoutMs` (kept below the
 * hosting platform's request limit). The key stays on the server.
 */
export function createNvidiaImageClient({
  apiKey,
  models,
  model,
  baseUrl,
  timeoutMs = 30000,
  totalTimeoutMs = 50000,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  const modelList = [models ?? model].flat().filter(Boolean);
  const fallback = createModelFallback(modelList);

  return {
    available: Boolean(apiKey) && modelList.length > 0,

    /** Resolves to `{ mime, data }` where `data` is base64. */
    async generate({ prompt, width = 896, height = 1088, seed = Math.floor(Math.random() * 2 ** 31) }) {
      if (!this.available) throw new LlmError('Image generation is not configured');

      return fallback.run(
        (modelId, attempt) =>
          requestImage(fetchImpl, {
            baseUrl,
            apiKey,
            modelId,
            request: { prompt, width, height, seed },
            timeoutMs: attempt.timeoutMs,
          }),
        {
          perAttemptMs: timeoutMs,
          totalMs: totalTimeoutMs,
          onSkip: (modelId, error) =>
            logger.warn(`Image model "${modelId}" failed (${error.status ?? error.message}); trying the next one`),
        },
      );
    },
  };
}
