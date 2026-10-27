import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

// Cheap guards for mistakes that only show up in a browser (a duplicate id once made a whole panel blank).
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const jsDir = new URL('../public/js/', import.meta.url);
const scripts = readdirSync(jsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => [f, readFileSync(new URL(f, jsDir), 'utf8')]);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

describe('index.html', () => {
  it('has no duplicate ids', () => {
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(duplicates, []);
  });

  it('contains every element the scripts look up by id', () => {
    const missing = [];
    for (const [file, source] of scripts) {
      for (const [, id] of source.matchAll(/byId\('([^']+)'\)/g)) {
        if (!ids.includes(id)) missing.push(`${file}: ${id}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it('keeps inline scripts, inline styles and external resources out of the page (strict CSP)', () => {
    assert.ok(!/<script(?![^>]*\bsrc=)/i.test(html), 'inline <script>');
    assert.ok(!/\sstyle="/i.test(html), 'inline style attribute');
    assert.ok(!/(?:src|href)="https?:\/\//i.test(html), 'external resource');
    assert.ok(!/\son[a-z]+="/i.test(html), 'inline event handler');
  });

  it('has a language, a title and a skip link', () => {
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /class="skip-link"/);
  });
});

describe('theme switch', () => {
  it('applies the saved or system theme before first paint, from a plain script that the CSP allows', () => {
    assert.match(html, /<script src="\/js\/theme-init\.js"><\/script>/);
    assert.ok(html.indexOf('theme-init.js') < html.indexOf('/js/main.js'), 'theme-init must load first');
  });

  it('has a theme button, and defines every colour token for both themes', () => {
    assert.match(html, /id="theme-btn"/);
    const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
    const tokens = (block) => new Set([...block.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));
    const light = tokens(/:root \{([\s\S]*?)\n\}/.exec(css)[1]);
    const dark = tokens(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/.exec(css)[1]);
    const shared = new Set(['--radius']); // sizes are the same in both themes
    const missing = [...light].filter((token) => !dark.has(token) && !shared.has(token));
    assert.deepEqual(missing, [], 'tokens defined for light but not dark');
  });
});

describe('browser scripts', () => {
  it('never write untrusted data with innerHTML, eval or document.write', () => {
    for (const [file, source] of scripts) {
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/.test(source), file);
    }
  });
});
