import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import { cspHeaderValue } from '../server/http/csp.js';
import { startServer } from '../testing/helpers.js';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const headerOf = (name) => vercel.headers.flatMap((h) => h.headers).find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;
const normalise = (policy) => policy.replace(/;\s*/g, ';').trim();

describe('Vercel deployment config', () => {
  it('rewrites every /api request to the Express function', () => {
    assert.deepEqual(vercel.rewrites, [{ source: '/api/(.*)', destination: '/api' }]);
    assert.ok(vercel.functions['api/index.js'], 'the function entry must be declared');
    assert.ok(vercel.functions['api/index.js'].maxDuration >= 30, 'AI and image calls need more than the 10 s default');
  });

  it('sends the same content-security policy for static files as Express sends for pages', async () => {
    const staticPolicy = headerOf('Content-Security-Policy');
    assert.equal(normalise(staticPolicy), normalise(cspHeaderValue()));

    const s = await startServer();
    try {
      const fromExpress = (await s.request('/')).headers.get('content-security-policy');
      assert.equal(normalise(fromExpress), normalise(staticPolicy));
    } finally {
      await s.close();
    }
  });

  it('adds the other security headers to static files, and leaves /api to Express', () => {
    assert.equal(headerOf('X-Content-Type-Options'), 'nosniff');
    assert.equal(headerOf('Referrer-Policy'), 'no-referrer');
    assert.match(headerOf('Permissions-Policy'), /camera=\(\)/);
    assert.match(vercel.headers[0].source, /\(\?!api\//);
  });
});

describe('Vercel function entry (api/index.js)', () => {
  it('exports the Express app, which answers health checks through a plain Node server', async () => {
    const { default: handler } = await import('../api/index.js');
    const server = createServer(handler);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const health = await fetch(`${base}/api/health`);
      assert.equal(health.status, 200);
      const body = await health.json();
      assert.equal(body.status, 'ok');
      assert.equal(health.headers.get('cache-control'), 'no-store');

      const missing = await fetch(`${base}/api/does-not-exist`);
      assert.equal(missing.status, 404);
      assert.equal((await missing.json()).error.code, 'not_found');

      // validation is wired up too
      const plan = await fetch(`${base}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(plan.status, 400);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
