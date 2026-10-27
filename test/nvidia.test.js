import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmError, createNvidiaClient } from '../server/services/nvidia.js';

const SECRET = 'nvapi-super-secret-key';
const options = {
  apiKey: SECRET,
  model: 'test-model',
  baseUrl: 'https://llm.test/v1',
  timeoutMs: 1000,
  retryDelayMs: 1,
};
const ok = (content) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const call = (client) => client.complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] });

describe('NVIDIA client', () => {
  it('sends an OpenAI-style request and returns the text', async () => {
    let seen;
    const client = createNvidiaClient({
      ...options,
      fetchImpl: async (url, init) => {
        seen = { url, init, body: JSON.parse(init.body) };
        return ok('hello');
      },
    });

    assert.equal(await call(client), 'hello');
    assert.equal(seen.url, 'https://llm.test/v1/chat/completions');
    assert.equal(seen.init.headers.Authorization, `Bearer ${SECRET}`);
    assert.equal(seen.body.model, 'test-model');
    assert.equal(seen.body.stream, false);
    assert.deepEqual(seen.body.messages[0], { role: 'system', content: 's' });
  });

  it('refuses to call out without an API key', async () => {
    let called = false;
    const client = createNvidiaClient({ ...options, apiKey: '', fetchImpl: async () => (called = true) });
    assert.equal(client.available, false);
    await assert.rejects(call(client), LlmError);
    assert.equal(called, false);
  });

  it('retries once on a 5xx and then succeeds', async () => {
    let attempts = 0;
    const client = createNvidiaClient({
      ...options,
      fetchImpl: async () => (++attempts === 1 ? new Response('boom', { status: 503 }) : ok('recovered')),
    });
    assert.equal(await call(client), 'recovered');
    assert.equal(attempts, 2);
  });

  it('does not retry client errors such as 401', async () => {
    let attempts = 0;
    const client = createNvidiaClient({
      ...options,
      fetchImpl: async () => {
        attempts += 1;
        return new Response('nope', { status: 401 });
      },
    });
    await assert.rejects(call(client), (e) => e instanceof LlmError && e.status === 401);
    assert.equal(attempts, 1);
  });

  it('turns network failures into a generic error that never leaks the key', async () => {
    const client = createNvidiaClient({
      ...options,
      retries: 0,
      fetchImpl: async () => {
        throw new Error(`connect failed with ${SECRET}`);
      },
    });
    await assert.rejects(call(client), (e) => e instanceof LlmError && !e.message.includes(SECRET));
  });

  it('rejects empty or malformed answers', async () => {
    for (const body of [{}, { choices: [] }, { choices: [{ message: { content: '  ' } }] }]) {
      const client = createNvidiaClient({ ...options, fetchImpl: async () => new Response(JSON.stringify(body)) });
      await assert.rejects(call(client), LlmError);
    }
  });

  it('times out slow responses', async () => {
    const client = createNvidiaClient({
      ...options,
      timeoutMs: 20,
      retries: 0,
      // AbortSignal.timeout() timers are unref'd, so keep the event loop alive while we wait.
      fetchImpl: (url, init) =>
        new Promise((resolve, reject) => {
          const keepAlive = setTimeout(resolve, 5000);
          init.signal.addEventListener('abort', () => {
            clearTimeout(keepAlive);
            reject(init.signal.reason);
          });
        }),
    });
    await assert.rejects(call(client), /timed out/);
  });
});

describe('NVIDIA client model fallback', () => {
  const gone = () => new Response('gone', { status: 410 });

  it('moves to the next model when one has been retired (HTTP 410) and remembers the working one', async () => {
    const tried = [];
    const client = createNvidiaClient({
      ...options,
      model: undefined,
      models: ['old/model', 'new/model'],
      logger: { warn() {} },
      fetchImpl: async (url, init) => {
        const { model } = JSON.parse(init.body);
        tried.push(model);
        return model === 'old/model' ? gone() : ok('fine');
      },
    });
    assert.equal(await call(client), 'fine');
    assert.equal(await call(client), 'fine');
    assert.deepEqual(tried, ['old/model', 'new/model', 'new/model']);
  });

  it('also skips models that answer 404', async () => {
    const client = createNvidiaClient({
      ...options,
      models: ['missing/model', 'ok/model'],
      logger: { warn() {} },
      fetchImpl: async (url, init) =>
        JSON.parse(init.body).model === 'missing/model' ? new Response('', { status: 404 }) : ok('hi'),
    });
    assert.equal(await call(client), 'hi');
  });

  it('fails clearly when every model has been retired', async () => {
    const client = createNvidiaClient({
      ...options,
      models: ['a/one', 'b/two'],
      logger: { warn() {} },
      fetchImpl: async () => gone(),
    });
    await assert.rejects(
      call(client),
      (e) => e instanceof LlmError && e.status === 410 && /NVIDIA_MODEL/.test(e.message),
    );
  });

  it('does not switch models for other errors such as 401', async () => {
    let attempts = 0;
    const client = createNvidiaClient({
      ...options,
      models: ['a/one', 'b/two'],
      fetchImpl: async () => {
        attempts += 1;
        return new Response('', { status: 401 });
      },
    });
    await assert.rejects(call(client), (e) => e.status === 401);
    assert.equal(attempts, 1);
  });
});
