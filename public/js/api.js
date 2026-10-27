export class ApiError extends Error {
  constructor(message, { code = 'error', details = [], status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const TIMEOUT_MS = 45_000;

/** Sends a request and returns the parsed JSON body. Throws an ApiError with a user-friendly message. */
async function request(path, init = {}) {
  let response;
  try {
    response = await fetch(path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError';
    throw new ApiError(
      timedOut ? 'That took too long. Please try again.' : 'Cannot reach the server. Check your connection.',
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* handled below */
  }

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message ?? 'Something went wrong. Please try again.', {
      code: error?.code,
      details: error?.details,
      status: response.status,
    });
  }
  if (!payload) throw new ApiError('The server sent an unexpected response.');
  return payload;
}

/** POSTs JSON and returns the parsed body. */
export const postJson = (path, body) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** GETs JSON with the given query values (empty values are left out). */
export function getJson(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  return request(`${path}?${query}`, { headers: { Accept: 'application/json' } });
}

/** Server status and feature flags; null if the server cannot be reached. */
export async function getHealth() {
  try {
    return await getJson('/api/health');
  } catch {
    return null;
  }
}
