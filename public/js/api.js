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

/** POSTs JSON and returns the parsed body. Throws ApiError with a user-friendly message. */
export async function postJson(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError';
    throw new ApiError(timedOut ? 'That took too long. Please try again.' : 'Cannot reach the server. Check your connection.');
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

/** GETs JSON with the given query values (empty values are left out). Throws ApiError. */
export async function getJson(path, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  let response;
  try {
    response = await fetch(`${path}?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new ApiError(error?.name === 'TimeoutError' ? 'That took too long. Please try again.' : 'Cannot reach the server. Check your connection.');
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* handled below */
  }
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message ?? 'Something went wrong. Please try again.', { code: error?.code, details: error?.details, status: response.status });
  }
  if (!payload) throw new ApiError('The server sent an unexpected response.');
  return payload;
}

export async function getHealth() {
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
