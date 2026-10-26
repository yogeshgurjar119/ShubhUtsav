import { LlmError } from './nvidia.js';

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
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 12 && head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/** A refusal by the safety filter is final: another model would be asked the same thing. */
class BlockedError extends LlmError {}

/**
 * Client for NVIDIA's hosted image models (FLUX) on the API catalog.
 * `models` is an ordered list: if one is retired, hangs or errors, the next is tried, and the
 * one that worked is remembered. The key stays on the server; failures become generic messages.
 */
export function createNvidiaImageClient({ apiKey, models, model, baseUrl, timeoutMs = 30000, fetchImpl = globalThis.fetch, logger = console }) {
  const modelList = [models ?? model].flat().filter(Boolean);
  let preferred = 0;

  async function generateWith(modelId, { prompt, width, height, seed }) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/${modelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ prompt, width, height, seed, ...(MODEL_PARAMS[modelId] ?? DEFAULT_PARAMS) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new LlmError(timedOut ? 'The image service timed out' : 'Could not reach the image service', { retryable: true, kind: timedOut ? 'timeout' : 'unavailable' });
    }
    if (!response.ok) throw new LlmError(`The image service returned status ${response.status}`, { status: response.status });

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new LlmError('The image service returned an unreadable response');
    }

    const artifact = payload?.artifacts?.[0];
    if (artifact?.finishReason === 'CONTENT_FILTERED') throw new BlockedError('The image was blocked by the safety filter', { kind: 'blocked' });
    const data = artifact?.base64 ?? payload?.data?.[0]?.b64_json ?? payload?.image;
    if (typeof data !== 'string' || data.length === 0 || data.length > MAX_BASE64_CHARS || !BASE64.test(data)) {
      throw new LlmError('The image service returned no usable image');
    }
    const mime = detectMime(data);
    if (!mime) throw new LlmError('The image service returned an unsupported file');
    return { mime, data };
  }

  return {
    available: Boolean(apiKey) && modelList.length > 0,

    /** Resolves to `{ mime, data }` where `data` is base64. */
    async generate({ prompt, width = 896, height = 1088, seed = Math.floor(Math.random() * 2 ** 31) }) {
      if (!this.available) throw new LlmError('Image generation is not configured');

      let lastError;
      for (let step = 0; step < modelList.length; step += 1) {
        const index = (preferred + step) % modelList.length;
        try {
          const image = await generateWith(modelList[index], { prompt, width, height, seed });
          preferred = index;
          return image;
        } catch (error) {
          if (error instanceof BlockedError || !(error instanceof LlmError)) throw error;
          lastError = error;
          logger.warn(`Image model "${modelList[index]}" failed (${error.status ?? error.message}); trying the next one`);
        }
      }
      throw lastError;
    },
  };
}
