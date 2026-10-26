/** Failure of a third-party data service. The message is safe to log and never contains keys. */
export class UpstreamError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

/**
 * Small in-memory cache with a time limit and a size limit. Concurrent requests for the same key
 * share one upstream call, which protects the (limited) API quotas.
 */
export function createCache({ ttlMs, maxEntries = 200, now = () => Date.now() }) {
  const entries = new Map();
  const loading = new Map();

  return {
    async getOrLoad(key, loader) {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value;
      if (loading.has(key)) return loading.get(key);

      const promise = loader()
        .then((value) => {
          entries.delete(key);
          entries.set(key, { value, expiresAt: now() + ttlMs });
          while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
          return value;
        })
        .finally(() => loading.delete(key));
      loading.set(key, promise);
      return promise;
    },
  };
}

/** GET JSON from an upstream API. The URL (which holds the API key) is never put in an error. */
export async function fetchJson(fetchImpl, url, { timeoutMs, label }) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new UpstreamError(timedOut ? `${label} timed out` : `Could not reach ${label}`);
  }
  if (!response.ok) throw new UpstreamError(`${label} returned status ${response.status}`, { status: response.status });
  try {
    return await response.json();
  } catch {
    throw new UpstreamError(`${label} returned an unreadable response`);
  }
}
