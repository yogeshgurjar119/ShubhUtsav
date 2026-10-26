import { EVENTS } from './catalog.js';

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Is the budget realistic for the headcount? Compares spend per guest with the
 * lean / comfortable benchmarks for the event type and city tier.
 */
export function assessFeasibility({ eventType, cityTier, guests, budget, venueType, daysLeft }) {
  const { lean, comfortable } = EVENTS[eventType].perGuest;
  const leanPerGuest = lean[cityTier];
  const comfortablePerGuest = comfortable[cityTier];
  const perGuest = Math.round(budget / guests);

  const status = perGuest < leanPerGuest ? 'insufficient' : perGuest < comfortablePerGuest ? 'tight' : 'comfortable';
  const advice = [];

  if (status === 'insufficient') {
    const affordableGuests = Math.max(2, Math.floor(budget / leanPerGuest));
    advice.push(
      `${inr(perGuest)} per guest is below the usual minimum of ${inr(leanPerGuest)} for this kind of event. ` +
        `Trim the guest list to about ${affordableGuests}, or raise the budget to ${inr(leanPerGuest * guests)}.`,
    );
    if (venueType !== 'home') advice.push('Hosting at home or in a community hall can free a large share of the budget.');
  } else if (status === 'tight') {
    advice.push(
      `${inr(perGuest)} per guest is workable but tight (comfortable is about ${inr(comfortablePerGuest)}). ` +
        'Spend on your top priorities and keep the rest simple.',
    );
  } else {
    advice.push(`${inr(perGuest)} per guest leaves room to add the extras you care about.`);
  }

  if (daysLeft < 14) {
    advice.push('With under two weeks to go, expect limited vendor availability and possible rush charges.');
  } else if (daysLeft < 30) {
    advice.push('With under a month to go, book the venue and caterer first; they sell out fastest.');
  }

  return { status, perGuest, leanPerGuest, comfortablePerGuest, advice };
}
