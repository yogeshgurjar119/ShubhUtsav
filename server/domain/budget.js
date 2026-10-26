import { CATEGORIES, CONTINGENCY_PCT, EVENTS, PRIORITY_BOOST, RUSHED_DAYS } from './catalog.js';

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Splits the budget across categories.
 *  - the contingency reserve is taken first (bigger when the event is close);
 *  - the rest is divided by the event type's weights, boosted for the host's priorities;
 *  - a home venue removes the venue line (its share flows to the other categories);
 *  - amounts are whole rupees and always add up exactly to the budget.
 */
export function allocateBudget({ eventType, budget, priorities = [], venueType, daysLeft }) {
  const weights = { ...EVENTS[eventType].weights };
  if (venueType === 'home') weights.venue = 0;
  for (const category of priorities) {
    if (weights[category] > 0) weights[category] += PRIORITY_BOOST;
  }

  const contingencyPct = daysLeft < RUSHED_DAYS ? CONTINGENCY_PCT.rushed : CONTINGENCY_PCT.normal;
  const contingency = Math.round((budget * contingencyPct) / 100);

  const amounts = splitProportionally(weights, budget - contingency);
  const allocations = Object.keys(amounts).map((category) => ({
    category,
    label: CATEGORIES[category],
    amount: amounts[category],
    percent: round1((amounts[category] / budget) * 100),
    priority: priorities.includes(category),
  }));

  return { total: budget, contingency: { percent: contingencyPct, amount: contingency }, allocations };
}

/** Largest-remainder method: whole-number shares that sum exactly to `total`. */
export function splitProportionally(weights, total) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const weightSum = entries.reduce((sum, [, w]) => sum + w, 0);
  const shares = entries.map(([key, w], index) => {
    const exact = (w / weightSum) * total;
    const floor = Math.floor(exact);
    return { key, index, floor, remainder: exact - floor };
  });

  let leftover = total - shares.reduce((sum, s) => sum + s.floor, 0);
  const byRemainder = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const share of byRemainder) {
    if (leftover <= 0) break;
    share.floor += 1;
    leftover -= 1;
  }
  return Object.fromEntries(shares.map((s) => [s.key, s.floor]));
}
