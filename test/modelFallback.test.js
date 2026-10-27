import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmError } from '../server/services/llmError.js';
import { createModelFallback, isModelProblem } from '../server/services/modelFallback.js';
import { createNvidiaClient } from '../server/services/nvidia.js';
import { createNvidiaImageClient } from '../server/services/nvidiaImage.js';
import { TINY_PNG } from '../testing/helpers.js';

const options = { perAttemptMs: 1000, totalMs: 5000 };
const quietLogger = { warn() {} };
const hang = (init) =>
  new Promise((resolve, reject) => {
    const keepAlive = setTimeout(resolve, 5000); // AbortSignal.timeout() timers are unref'd, so keep the loop alive
    init.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(init.signal.reason);
    });
  });

describe('isModelProblem', () => {
  it('treats retired, slow, overloaded and empty-answer failures as model problems', () => {
    for (const error of [
      new LlmError('x', { status: 404 }),
      new LlmError('x', { status: 410 }),
      new LlmError('x', { status: 429 }),
      new LlmError('x', { status: 500 }),
      new LlmError('x', { kind: 'timeout' }),
      new LlmError('x'),
    ]) {
      assert.equal(isModelProblem(error), true, JSON.stringify(error));
    }
  });

  it('treats bad credentials, safety blocks and non-AI errors as final', () => {
    assert.equal(isModelProblem(new LlmError('x', { status: 401 })), false);
    assert.equal(isModelProblem(new LlmError('x', { status: 403 })), false);
    assert.equal(isModelProblem(new LlmError('x', { kind: 'blocked' })), false);
    assert.equal(isModelProblem(new TypeError('bug')), false);
  });
});

describe('createModelFallback', () => {
  it('uses the first model that works and remembers it', async () => {
    const fallback = createModelFallback(['a', 'b', 'c']);
    const tried = [];
    const attempt = async (model) => {
      tried.push(model);
      if (model === 'a') throw new LlmError('gone', { status: 410 });
      return model;
    };
    assert.equal(await fallback.run(attempt, options), 'b');
    assert.equal(await fallback.run(attempt, options), 'b');
    assert.deepEqual(tried, ['a', 'b', 'b']);
  });

  it('throws final errors at once without trying other models', async () => {
    const fallback = createModelFallback(['a', 'b']);
    let calls = 0;
    await assert.rejects(
      fallback.run(async () => {
        calls += 1;
        throw new LlmError('bad key', { status: 401 });
      }, options),
      /bad key/,
    );
    assert.equal(calls, 1);
  });

  it('stops when the total time budget is used up and gives each attempt only the time left', async () => {
    let clock = 0;
    const fallback = createModelFallback(['a', 'b', 'c'], { now: () => clock });
    const granted = [];
    const attempt = async (model, { timeoutMs }) => {
      granted.push(timeoutMs);
      clock += timeoutMs; // every model uses all the time it is given
      throw new LlmError('slow', { kind: 'timeout' });
    };
    await assert.rejects(fallback.run(attempt, { perAttemptMs: 30, totalMs: 50 }), (e) => e.kind === 'timeout');
    assert.deepEqual(granted, [30, 20]); // the third model never starts: the budget is gone
  });

  it('reports a timeout when there is no budget at all', async () => {
    const fallback = createModelFallback(['a']);
    await assert.rejects(
      fallback.run(async () => 'x', { perAttemptMs: 10, totalMs: 0 }),
      (e) => e.kind === 'timeout',
    );
  });

  it('passes the skipped model and error to onSkip', async () => {
    const fallback = createModelFallback(['a', 'b']);
    const skipped = [];
    await fallback.run(
      async (model) => {
        if (model === 'a') throw new LlmError('gone', { status: 404 });
        return 'ok';
      },
      { ...options, onSkip: (model, error) => skipped.push([model, error.status]) },
    );
    assert.deepEqual(skipped, [['a', 404]]);
  });
});

describe('AI clients use the shared fallback', () => {
  const chatOk = (content) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));

  it('text: a model that hangs is skipped and the next one answers', async () => {
    const tried = [];
    const client = createNvidiaClient({
      apiKey: 'k',
      models: ['slow/model', 'fast/model'],
      baseUrl: 'https://llm.test/v1',
      timeoutMs: 40,
      logger: quietLogger,
      fetchImpl: async (url, init) => {
        const { model } = JSON.parse(init.body);
        tried.push(model);
        return model === 'slow/model' ? hang(init) : chatOk('hello');
      },
    });
    const reply = await client.complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(reply, 'hello');
    assert.deepEqual(tried, ['slow/model', 'fast/model']); // the timeout was not retried
  });

  it('text: a 5xx model is retried once and then skipped', async () => {
    const tried = [];
    const client = createNvidiaClient({
      apiKey: 'k',
      models: ['broken/model', 'ok/model'],
      baseUrl: 'https://llm.test/v1',
      retryDelayMs: 1,
      logger: quietLogger,
      fetchImpl: async (url, init) => {
        const { model } = JSON.parse(init.body);
        tried.push(model);
        return model === 'broken/model' ? new Response('', { status: 503 }) : chatOk('fine');
      },
    });
    assert.equal(await client.complete({ system: 's', messages: [] }), 'fine');
    assert.deepEqual(tried, ['broken/model', 'broken/model', 'ok/model']);
  });

  it('text: gives up inside the total budget instead of trying every slow model', async () => {
    let calls = 0;
    const client = createNvidiaClient({
      apiKey: 'k',
      models: ['a/one', 'b/two', 'c/three'],
      baseUrl: 'https://llm.test/v1',
      timeoutMs: 60,
      totalTimeoutMs: 90,
      logger: quietLogger,
      fetchImpl: (url, init) => {
        calls += 1;
        return hang(init);
      },
    });
    const started = Date.now();
    await assert.rejects(client.complete({ system: 's', messages: [] }), (e) => e.kind === 'timeout');
    assert.ok(Date.now() - started < 400, 'must not wait for a third attempt');
    assert.equal(calls, 2);
  });

  it('image: respects the total budget when the first model hangs', async () => {
    const tried = [];
    const client = createNvidiaImageClient({
      apiKey: 'k',
      models: ['slow/model', 'fast/model'],
      baseUrl: 'https://img.test/v1/genai',
      timeoutMs: 200,
      totalTimeoutMs: 260,
      logger: quietLogger,
      fetchImpl: async (url, init) => {
        tried.push(url.split('/genai/')[1]);
        return url.endsWith('slow/model')
          ? hang(init)
          : new Response(JSON.stringify({ artifacts: [{ base64: TINY_PNG, finishReason: 'SUCCESS' }] }));
      },
    });
    assert.equal((await client.generate({ prompt: 'p' })).mime, 'image/png');
    assert.deepEqual(tried, ['slow/model', 'fast/model']);
  });
});
