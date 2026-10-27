import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../server/config.js';

describe('loadConfig', () => {
  it('uses safe defaults with an empty environment', () => {
    const config = loadConfig({});
    assert.equal(config.port, 3000);
    assert.equal(config.nvidia.apiKey, '');
    assert.equal(config.calendarific.apiKey, '');
    assert.equal(config.ticketmaster.apiKey, '');
    assert.ok(config.nvidia.models.length >= 2);
  });

  it('reads the official variable names', () => {
    const config = loadConfig({ CALENDARIFIC_API_KEY: ' cal ', TICKETMASTER_API_KEY: 'tm' });
    assert.equal(config.calendarific.apiKey, 'cal');
    assert.equal(config.ticketmaster.apiKey, 'tm');
  });

  it('also accepts common misspellings, and the official name wins', () => {
    assert.equal(loadConfig({ CALENDRIFIC: 'a' }).calendarific.apiKey, 'a');
    assert.equal(loadConfig({ TICKMASTER_KEY: 'b' }).ticketmaster.apiKey, 'b');
    assert.equal(
      loadConfig({ TICKETMASTER_API_KEY: 'official', TICKMASTER_KEY: 'typo' }).ticketmaster.apiKey,
      'official',
    );
  });

  it('ignores the Ticketmaster secret (only the consumer key is needed)', () => {
    assert.equal(loadConfig({ TICKMASTER_SECRET: 'secret' }).ticketmaster.apiKey, '');
  });

  it('lists working image models by default and keeps your choice first', () => {
    const defaults = loadConfig({}).image.models;
    assert.ok(defaults.includes('black-forest-labs/flux.2-klein-4b'));
    assert.ok(!defaults.includes('black-forest-labs/flux.1-schnell'));
    assert.equal(loadConfig({ NVIDIA_IMAGE_MODEL: 'my/image' }).image.models[0], 'my/image');
  });

  it('keeps your preferred NVIDIA models first and adds the defaults after them', () => {
    const { models } = loadConfig({ NVIDIA_MODEL: 'my/model' }).nvidia;
    assert.equal(models[0], 'my/model');
    assert.ok(models.length > 1);
  });
});
