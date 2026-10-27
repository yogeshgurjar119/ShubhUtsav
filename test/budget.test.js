import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateBudget, splitProportionally } from '../server/domain/budget.js';
import { EVENT_TYPES } from '../server/domain/catalog.js';

const base = { eventType: 'wedding', budget: 1_000_003, priorities: [], venueType: 'hall', daysLeft: 120 };
const sum = (plan) => plan.allocations.reduce((s, a) => s + a.amount, 0) + plan.contingency.amount;

describe('splitProportionally', () => {
  it('returns whole numbers that sum exactly to the total', () => {
    const shares = splitProportionally({ a: 1, b: 1, c: 1 }, 100);
    assert.equal(
      Object.values(shares).reduce((s, n) => s + n, 0),
      100,
    );
    assert.ok(Object.values(shares).every(Number.isInteger));
  });

  it('skips zero weights', () => {
    assert.deepEqual(splitProportionally({ a: 0, b: 5 }, 10), { b: 10 });
  });
});

describe('allocateBudget', () => {
  for (const eventType of EVENT_TYPES) {
    it(`adds up exactly to the budget for ${eventType}`, () => {
      for (const budget of [5000, 99_999, 1_234_567]) {
        const plan = allocateBudget({ ...base, eventType, budget });
        assert.equal(sum(plan), budget);
      }
    });
  }

  it('reserves more contingency when the event is close', () => {
    assert.equal(allocateBudget({ ...base, daysLeft: 120 }).contingency.percent, 7);
    assert.equal(allocateBudget({ ...base, daysLeft: 10 }).contingency.percent, 10);
  });

  it('gives priority categories a bigger share', () => {
    const plain = allocateBudget(base).allocations.find((a) => a.category === 'decor');
    const boosted = allocateBudget({ ...base, priorities: ['decor'] }).allocations.find((a) => a.category === 'decor');
    assert.ok(boosted.amount > plain.amount);
    assert.equal(boosted.priority, true);
  });

  it('drops the venue line for a home venue and still sums to the budget', () => {
    const plan = allocateBudget({ ...base, venueType: 'home' });
    assert.equal(
      plan.allocations.some((a) => a.category === 'venue'),
      false,
    );
    assert.equal(sum(plan), base.budget);
  });

  it('ignores a priority for a category the event does not use', () => {
    const plan = allocateBudget({ ...base, eventType: 'community', priorities: ['attire'] });
    assert.equal(
      plan.allocations.some((a) => a.category === 'attire'),
      false,
    );
  });
});
