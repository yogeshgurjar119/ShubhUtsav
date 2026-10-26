import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiIdeasSchema, makeEventInputSchema } from '../server/domain/schemas.js';
import { TODAY, validEvent } from '../testing/helpers.js';

const schema = makeEventInputSchema(TODAY);
const fails = (input, field) => {
  const result = schema.safeParse(input);
  assert.equal(result.success, false);
  if (field) assert.ok(result.error.issues.some((i) => i.path.join('.') === field), `expected an issue on ${field}`);
};

describe('event input schema', () => {
  it('accepts a valid event and fills defaults', () => {
    const { eventType, guests, budget, eventDate } = validEvent();
    const parsed = schema.parse({ eventType, guests, budget, eventDate });
    assert.equal(parsed.cityTier, 'tier2');
    assert.equal(parsed.venueType, 'hall');
    assert.deepEqual(parsed.priorities, []);
  });

  it('rejects out-of-range numbers and wrong types', () => {
    fails(validEvent({ guests: 1 }), 'guests');
    fails(validEvent({ guests: 5001 }), 'guests');
    fails(validEvent({ guests: '200' }), 'guests');
    fails(validEvent({ guests: 20.5 }), 'guests');
    fails(validEvent({ budget: 100 }), 'budget');
  });

  it('rejects past, malformed and too-distant dates', () => {
    fails(validEvent({ eventDate: '2026-10-25' }), 'eventDate');
    fails(validEvent({ eventDate: '2027-02-30' }), 'eventDate');
    fails(validEvent({ eventDate: '30/06/2027' }), 'eventDate');
    fails(validEvent({ eventDate: '2031-01-01' }), 'eventDate');
  });

  it('accepts today as the event date', () => {
    assert.equal(schema.safeParse(validEvent({ eventDate: TODAY })).success, true);
  });

  it('rejects unknown keys and unknown enum values', () => {
    fails({ ...validEvent(), admin: true });
    fails(validEvent({ eventType: 'funeral' }), 'eventType');
    fails(validEvent({ priorities: ['catering', 'catering'] }), 'priorities');
    fails(validEvent({ priorities: ['venue', 'decor', 'catering', 'attire'] }), 'priorities');
  });

  it('trims notes, strips control characters and caps the length', () => {
    assert.equal(schema.parse(validEvent({ notes: '  hello\u0007 world  ' })).notes, 'hello world');
    fails(validEvent({ notes: 'x'.repeat(501) }), 'notes');
  });
});

describe('AI ideas schema', () => {
  const ok = {
    themes: [{ title: 'Garden', description: 'Flowers and lights' }],
    menu: ['Chaat'],
    entertainment: ['DJ'],
    budgetTips: ['Use seasonal flowers'],
  };

  it('accepts a well-formed answer', () => {
    assert.equal(aiIdeasSchema.safeParse(ok).success, true);
  });

  it('rejects missing sections, oversize strings and non-strings', () => {
    assert.equal(aiIdeasSchema.safeParse({ ...ok, menu: undefined }).success, false);
    assert.equal(aiIdeasSchema.safeParse({ ...ok, menu: ['x'.repeat(121)] }).success, false);
    assert.equal(aiIdeasSchema.safeParse({ ...ok, entertainment: [42] }).success, false);
  });
});

describe('public event rules', () => {
  it('allows large crowds only for public events', () => {
    assert.equal(schema.safeParse(validEvent({ eventType: 'public', venueType: 'outdoor', guests: 20_000 })).success, true);
    fails(validEvent({ eventType: 'wedding', guests: 5001 }), 'guests');
    fails(validEvent({ eventType: 'public', venueType: 'outdoor', guests: 50_001 }), 'guests');
  });

  it('does not allow a public event at home', () => {
    fails(validEvent({ eventType: 'public', venueType: 'home', guests: 500 }), 'venueType');
  });
});
