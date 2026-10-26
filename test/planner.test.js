import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, diffDays, isValidIsoDate, todayIn } from '../server/domain/dates.js';
import { assessFeasibility } from '../server/domain/feasibility.js';
import { createPlan } from '../server/domain/planner.js';
import { buildTimeline } from '../server/domain/timeline.js';
import { TODAY, validEvent } from '../testing/helpers.js';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    assert.equal(isValidIsoDate('2028-02-29'), true);
    assert.equal(isValidIsoDate('2027-02-29'), false);
    assert.equal(isValidIsoDate('2027-13-01'), false);
    assert.equal(isValidIsoDate('tomorrow'), false);
  });

  it('adds and subtracts days across month ends', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(diffDays('2026-10-26', '2026-12-25'), 60);
  });

  it('computes today in the requested timezone', () => {
    const instant = new Date('2026-10-25T20:00:00Z'); // 01:30 next day in India
    assert.equal(todayIn('Asia/Kolkata', instant), '2026-10-26');
    assert.equal(todayIn('UTC', instant), '2026-10-25');
  });
});

describe('buildTimeline', () => {
  it('uses the full template when there is enough time', () => {
    const t = buildTimeline({ eventType: 'wedding', eventDate: '2027-09-01', today: TODAY });
    assert.equal(t.compressed, false);
    assert.equal(t.milestones.at(-1).date, '2027-09-01');
    assert.equal(t.milestones[0].daysBefore, 270);
  });

  it('compresses proportionally and never schedules before today', () => {
    const t = buildTimeline({ eventType: 'wedding', eventDate: '2026-12-25', today: TODAY });
    assert.equal(t.compressed, true);
    assert.ok(t.milestones.every((m) => m.date >= TODAY));
    assert.equal(t.milestones.at(-1).date, '2026-12-25');
  });

  it('merges milestones that land on the same day', () => {
    const t = buildTimeline({ eventType: 'wedding', eventDate: TODAY, today: TODAY });
    assert.equal(t.milestones.length, 1);
    assert.ok(t.milestones[0].tasks.length > 3);
  });

  it('keeps milestones in chronological order', () => {
    const t = buildTimeline({ eventType: 'community', eventDate: '2026-12-01', today: TODAY });
    const dates = t.milestones.map((m) => m.date);
    assert.deepEqual(dates, [...dates].sort());
  });
});

describe('assessFeasibility', () => {
  const args = { eventType: 'wedding', cityTier: 'tier2', guests: 200, venueType: 'hall', daysLeft: 200 };

  it('flags an insufficient budget and suggests a guest count', () => {
    const r = assessFeasibility({ ...args, budget: 200_000 });
    assert.equal(r.status, 'insufficient');
    assert.match(r.advice[0], /Trim the guest list to about 111/);
  });

  it('distinguishes tight from comfortable', () => {
    assert.equal(assessFeasibility({ ...args, budget: 500_000 }).status, 'tight');
    assert.equal(assessFeasibility({ ...args, budget: 900_000 }).status, 'comfortable');
  });

  it('warns about vendor availability when time is short', () => {
    const r = assessFeasibility({ ...args, budget: 900_000, daysLeft: 10 });
    assert.ok(r.advice.some((a) => /two weeks/.test(a)));
  });
});

describe('createPlan', () => {
  it('is deterministic for the same input and date', () => {
    const input = validEvent();
    assert.deepEqual(createPlan(input, TODAY), createPlan(input, TODAY));
  });

  it('adapts the checklist to venue and diet', () => {
    const ids = (plan) => plan.checklist.flatMap((g) => g.items.map((i) => i.id));

    const hall = ids(createPlan(validEvent({ venueType: 'hall', dietary: 'mixed' }), TODAY));
    assert.ok(hall.includes('venue-book'));
    assert.ok(!hall.includes('venue-home'));
    assert.ok(!hall.includes('catering-veg'));

    const homeJain = ids(createPlan(validEvent({ venueType: 'home', dietary: 'jain' }), TODAY));
    assert.ok(homeJain.includes('venue-home'));
    assert.ok(homeJain.includes('catering-jain'));
    assert.ok(!homeJain.includes('venue-book'));
  });

  it('marks items urgent when the ideal booking date has passed', () => {
    const plan = createPlan(validEvent({ eventDate: '2026-12-26' }), TODAY);
    const venue = plan.checklist.find((g) => g.category === 'venue').items[0];
    assert.equal(venue.urgent, true);
    assert.equal(venue.bookBy, TODAY);
  });

  it('only includes event-specific tasks for that event type', () => {
    const ids = createPlan(validEvent({ eventType: 'birthday', guests: 30, budget: 60_000 }), TODAY).checklist.flatMap((g) =>
      g.items.map((i) => i.id),
    );
    assert.ok(!ids.includes('attire-fit'));
    assert.ok(!ids.includes('logi-stay'));
  });

  it('attaches each category allocation to its checklist group', () => {
    const plan = createPlan(validEvent(), TODAY);
    for (const group of plan.checklist) {
      const allocation = plan.budget.allocations.find((a) => a.category === group.category);
      assert.equal(group.allocation, allocation?.amount ?? 0);
    }
  });
});

describe('public events', () => {
  const publicEvent = (overrides = {}) =>
    validEvent({ eventType: 'public', guests: 8000, budget: 3_000_000, venueType: 'outdoor', priorities: ['entertainment'], ...overrides });

  it('builds a plan with permits, security and crowd safety tasks', () => {
    const plan = createPlan(publicEvent(), TODAY);
    const ids = plan.checklist.flatMap((g) => g.items.map((i) => i.id));
    for (const id of ['pub-permits', 'pub-security', 'pub-crowd', 'pub-medical', 'pub-ticketing']) assert.ok(ids.includes(id), id);
    assert.ok(!ids.includes('attire-buy'));
    assert.equal(plan.summary.eventLabel, 'Public event');
  });

  it('still splits the budget exactly and has no attire or gifts line', () => {
    const { budget } = createPlan(publicEvent(), TODAY);
    const total = budget.allocations.reduce((s, a) => s + a.amount, 0) + budget.contingency.amount;
    assert.equal(total, 3_000_000);
    assert.ok(!budget.allocations.some((a) => a.category === 'attire' || a.category === 'gifts'));
  });

  it('has its own timeline that starts with defining the event and ends on the day', () => {
    const t = buildTimeline({ eventType: 'public', eventDate: '2027-06-20', today: TODAY });
    assert.equal(t.milestones[0].title, 'Define the event');
    assert.equal(t.milestones.at(-1).date, '2027-06-20');
  });
});
