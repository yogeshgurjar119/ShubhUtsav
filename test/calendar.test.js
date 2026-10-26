import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeDate, parseIcs } from '../server/domain/calendar.js';
import { createCalendarService } from '../server/services/calendar.js';
import { silentLogger } from '../testing/helpers.js';

const vevent = (date, summary, description = 'Observance') =>
  `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${date}\r\nDTEND;VALUE=DATE:${date}\r\nSUMMARY:${summary}\r\nDESCRIPTION:${description}\r\nEND:VEVENT\r\n`;
const feed = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('')}END:VCALENDAR\r\n`;

describe('parseIcs', () => {
  it('reads dates, names and holiday kind, sorted by date', () => {
    const events = parseIcs(feed(vevent('20271029', 'Diwali/Deepavali', 'Public holiday'), vevent('20270322', 'Holi', 'Public holiday'), vevent('20270306', 'Maha Shivaratri')));
    assert.deepEqual(
      events.map((e) => [e.date, e.name, e.kind]),
      [
        ['2027-03-06', 'Maha Shivaratri', 'observance'],
        ['2027-03-22', 'Holi', 'public'],
        ['2027-10-29', 'Diwali/Deepavali', 'public'],
      ],
    );
  });

  it('flags tentative dates, unescapes text and removes duplicates', () => {
    const events = parseIcs(
      feed(vevent('20270617', 'Muharram\\, Ashura (tentative)', 'Public holiday\\nDate is tentative'), vevent('20270617', 'Muharram\\, Ashura (tentative)')),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'Muharram, Ashura (tentative)');
    assert.equal(events[0].tentative, true);
  });

  it('handles folded lines and skips malformed or impossible entries', () => {
    const folded = 'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270101\r\nSUMMARY:New Year\r\n \'s Day\r\nEND:VEVENT\r\n';
    const events = parseIcs(feed(folded, vevent('20270230', 'Impossible day'), 'BEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT\r\n', vevent('2027', 'Bad date')));
    assert.deepEqual(events.map((e) => e.name), ["New Year's Day"]);
  });

  it('strips control characters and caps long names', () => {
    const [event] = parseIcs(feed(vevent('20270101', `Bad\u0007Name${'x'.repeat(200)}`)));
    assert.ok(![...event.name].some((ch) => ch.charCodeAt(0) < 32));
    assert.ok(event.name.length <= 80);
  });
});

describe('analyzeDate', () => {
  const events = parseIcs(feed(vevent('20271029', 'Diwali/Deepavali', 'Public holiday'), vevent('20271031', 'Bhai Duj'), vevent('20270322', 'Holi', 'Public holiday')));

  it('warns when the date is itself a festival', () => {
    const r = analyzeDate({ eventDate: '2027-10-29', events });
    assert.equal(r.nearby[0].name, 'Diwali/Deepavali');
    assert.match(r.advice[0], /Popular vendors fill up early/);
  });

  it('warns about travel when a public holiday is close', () => {
    const r = analyzeDate({ eventDate: '2027-10-27', events });
    assert.ok(r.advice.some((a) => /Guests may be travelling/.test(a)));
  });

  it('reports the weekday and gives weekend or weekday advice', () => {
    const saturday = analyzeDate({ eventDate: '2027-06-19', events });
    assert.equal(saturday.weekday, 'Saturday');
    assert.equal(saturday.isWeekend, true);
    assert.ok(saturday.advice.some((a) => /high-demand/.test(a)));

    const tuesday = analyzeDate({ eventDate: '2027-06-22', events });
    assert.equal(tuesday.weekday, 'Tuesday');
    assert.ok(tuesday.advice.some((a) => /easier to book/.test(a)));
  });

  it('ignores events outside the window and caps the card list', () => {
    assert.equal(analyzeDate({ eventDate: '2027-06-22', events }).nearby.length, 0);
    const many = parseIcs(feed(...Array.from({ length: 12 }, (_, i) => vevent(`202706${String(10 + i).padStart(2, '0')}`, `Fest ${i}`))));
    assert.equal(analyzeDate({ eventDate: '2027-06-15', events: many, windowDays: 10 }).nearby.length, 8);
  });
});

describe('calendar service', () => {
  const okResponse = () => new Response(feed(vevent('20271029', 'Diwali', 'Public holiday')), { status: 200 });
  const make = (fetchImpl, extra = {}) => createCalendarService({ url: 'https://feed.test/x.ics', fetchImpl, logger: silentLogger, ...extra });

  it('downloads once and serves the cache afterwards', async () => {
    let calls = 0;
    const service = make(async () => (calls++, okResponse()));
    assert.equal((await service.getEvents()).length, 1);
    assert.equal((await service.getEvents()).length, 1);
    assert.equal(calls, 1);
  });

  it('shares one download between simultaneous requests', async () => {
    let calls = 0;
    const service = make(async () => (calls++, okResponse()));
    await Promise.all([service.getEvents(), service.getEvents(), service.getEvents()]);
    assert.equal(calls, 1);
  });

  it('returns an empty list on failure and does not retry immediately', async () => {
    let calls = 0;
    const service = make(async () => {
      calls += 1;
      throw new Error('network down');
    });
    assert.deepEqual(await service.getEvents(), []);
    assert.deepEqual(await service.getEvents(), []);
    assert.equal(calls, 1);
  });

  it('treats a bad status or an empty feed as a failure', async () => {
    assert.deepEqual(await make(async () => new Response('no', { status: 500 })).getEvents(), []);
    assert.deepEqual(await make(async () => new Response(feed(), { status: 200 })).getEvents(), []);
  });

  it('refreshes after the cache expires and keeps stale data if the refresh fails', async () => {
    let clock = 0;
    let fail = false;
    const service = make(async () => (fail ? new Response('no', { status: 503 }) : okResponse()), { now: () => clock, ttlMs: 1000, failureTtlMs: 100 });
    assert.equal((await service.getEvents()).length, 1);
    fail = true;
    clock = 2000;
    assert.equal((await service.getEvents()).length, 1);
  });

  it('is inert when no URL is configured', async () => {
    const service = createCalendarService({ url: '', fetchImpl: async () => assert.fail('must not fetch'), logger: silentLogger });
    assert.equal(service.available, false);
    assert.deepEqual(await service.getEvents(), []);
  });
});
