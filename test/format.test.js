import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addMonths,
  daysLabel,
  formatDate,
  formatINR,
  formatIndianWords,
  setServerToday,
  todayPlus,
} from '../public/js/format.js';

// These browser helpers use no DOM, so they can be tested directly in Node.
describe('addMonths', () => {
  it('adds calendar months and keeps the day', () => {
    assert.equal(addMonths('2026-10-26', 0), '2026-10-26');
    assert.equal(addMonths('2026-10-26', 6), '2027-04-26');
    assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  });

  it('uses the last day of a shorter month instead of rolling into the next one', () => {
    assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
    assert.equal(addMonths('2027-12-31', 2), '2028-02-29'); // leap year
    assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  });
});

describe('server date', () => {
  it('uses the server date once it is known, so pickers match the server timezone', () => {
    setServerToday('2026-10-26');
    assert.equal(todayPlus(0), '2026-10-26');
    assert.equal(todayPlus(6), '2027-04-26');
    setServerToday('2026-10-27');
    assert.equal(todayPlus(0), '2026-10-27');
  });

  it('ignores a malformed server date and keeps the last good one', () => {
    setServerToday('2026-10-26');
    for (const bad of ['tomorrow', '', null, undefined, '26-10-2026']) setServerToday(bad);
    assert.equal(todayPlus(0), '2026-10-26');
  });
});

describe('formatting', () => {
  it('formats dates without timezone shifts', () => {
    assert.equal(formatDate('2027-03-21'), '21 March 2027');
    assert.equal(formatDate('2027-01-01'), '1 January 2027');
  });

  it('says amounts the Indian way', () => {
    assert.equal(formatIndianWords(1_200_000), '₹12 lakh');
    assert.equal(formatIndianWords(25_000_000), '₹2.5 crore');
    assert.equal(formatIndianWords(60_000), '₹60 thousand');
    assert.equal(formatIndianWords(500), '₹500');
    assert.match(formatINR(1_200_000), /12,00,000/);
  });

  it('labels days', () => {
    assert.deepEqual([daysLabel(0), daysLabel(1), daysLabel(30)], ['Today', '1 day', '30 days']);
  });
});
