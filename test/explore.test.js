import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  makeEventsQuerySchema,
  makeFestivalQuerySchema,
  normalizeEvents,
  normalizeHolidays,
} from '../server/domain/explore.js';
import { createCalendarificService } from '../server/services/calendarific.js';
import { createTicketmasterService } from '../server/services/ticketmaster.js';
import { UpstreamError, createCache } from '../server/services/upstream.js';
import { TODAY, fakeCalendarific, fakeTicketmaster, startServer } from '../testing/helpers.js';

const KEY = 'secret-explore-key-123';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

const holidayPayload = {
  meta: { code: 200 },
  response: {
    holidays: [
      { name: 'Diwali', description: 'Festival of lights', date: { iso: '2027-10-29' }, type: ['National holiday'] },
      {
        name: 'Holi',
        description: 'Festival of colours',
        date: { iso: '2027-03-22' },
        type: ['National holiday', 'Hinduism'],
      },
      { name: 'Broken', date: { iso: 'not-a-date' }, type: [] },
      { description: 'no name', date: { iso: '2027-01-01' } },
    ],
  },
};

const eventPayload = {
  _embedded: {
    events: [
      {
        id: 'abc123',
        name: 'Rock Night',
        url: 'https://www.ticketmaster.com/event/abc123',
        dates: { start: { localDate: '2026-11-20', localTime: '19:30:00' }, status: { code: 'onsale' } },
        classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
        priceRanges: [{ min: 40, max: 120, currency: 'USD' }],
        images: [
          { url: 'https://s1.ticketm.net/small.jpg', width: 200 },
          { url: 'https://s1.ticketm.net/medium.jpg', width: 400 },
          { url: 'https://evil.example.com/x.jpg', width: 400 },
        ],
        _embedded: { venues: [{ name: 'Big Arena', city: { name: 'Austin' }, country: { countryCode: 'US' } }] },
      },
      {
        name: 'Bad link',
        url: 'javascript:alert(1)',
        dates: { start: { localDate: '2026-11-21' } },
        images: [{ url: 'http://s1.ticketm.net/a.jpg' }],
      },
      { name: 'No date', dates: { start: {} } },
    ],
  },
};

describe('normalizeHolidays', () => {
  it('keeps valid entries, sorted by date, and drops broken ones', () => {
    const list = normalizeHolidays(holidayPayload);
    assert.deepEqual(
      list.map((h) => [h.date, h.name]),
      [
        ['2027-03-22', 'Holi'],
        ['2027-10-29', 'Diwali'],
      ],
    );
    assert.deepEqual(list[0].types, ['National holiday', 'Hinduism']);
  });

  it('returns an empty list for unexpected payloads and caps long text', () => {
    assert.deepEqual(normalizeHolidays(null), []);
    assert.deepEqual(normalizeHolidays({ response: { holidays: 'nope' } }), []);
    const [h] = normalizeHolidays({
      response: { holidays: [{ name: 'x'.repeat(500), description: 'y'.repeat(900), date: { iso: '2027-01-01' } }] },
    });
    assert.ok(h.name.length <= 100 && h.description.length <= 220);
  });
});

describe('normalizeEvents', () => {
  const events = normalizeEvents(eventPayload);

  it('maps the useful fields', () => {
    assert.equal(events[0].name, 'Rock Night');
    assert.equal(events[0].time, '19:30');
    assert.equal(events[0].venue, 'Big Arena');
    assert.equal(events[0].city, 'Austin');
    assert.equal(events[0].category, 'Music');
    assert.deepEqual([events[0].priceMin, events[0].priceMax, events[0].currency], [40, 120, 'USD']);
  });

  it('only accepts https links and Ticketmaster image hosts', () => {
    assert.equal(events[0].image, 'https://s1.ticketm.net/medium.jpg');
    assert.equal(events[1].url, '');
    assert.equal(events[1].image, '');
  });

  it('skips events without a real date and tolerates empty responses', () => {
    assert.equal(events.length, 2);
    assert.deepEqual(normalizeEvents({}), []);
  });
});

describe('explore query schemas', () => {
  const festivals = makeFestivalQuerySchema(TODAY);
  const events = makeEventsQuerySchema(TODAY);

  it('festivals: defaults to India and this year, and coerces numbers from the query string', () => {
    assert.deepEqual(festivals.parse({}), { country: 'IN', year: 2026 });
    assert.deepEqual(festivals.parse({ country: 'US', year: '2027', month: '10' }), {
      country: 'US',
      year: 2027,
      month: 10,
    });
  });

  it('festivals: rejects unknown countries, odd years, bad months and extra keys', () => {
    for (const bad of [
      { country: 'XX' },
      { country: 'in' },
      { year: '1999' },
      { year: '2100' },
      { month: '13' },
      { month: '0' },
      { admin: '1' },
    ]) {
      assert.equal(festivals.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });

  it('events: fills the date range and accepts normal searches', () => {
    const q = events.parse({ country: 'US', city: 'New York', keyword: "St. Patrick's Day", category: 'music' });
    assert.equal(q.from, TODAY);
    assert.equal(q.to, '2026-11-25');
  });

  it('events: enforces the date rules', () => {
    const fails = (q) => assert.equal(events.safeParse({ country: 'US', ...q }).success, false, JSON.stringify(q));
    fails({ from: '2026-10-01' });
    fails({ from: '2026-11-10', to: '2026-11-01' });
    fails({ from: '2026-11-01', to: '2027-06-01' });
    fails({ from: '2026-02-30' });
  });

  it('events: rejects markup, operators and unknown values in free text', () => {
    for (const bad of [
      { city: '<script>' },
      { keyword: 'a;b' },
      { city: 'x'.repeat(61) },
      { category: 'weapons' },
      { country: 'ZZ' },
      { page: '2' },
    ]) {
      assert.equal(events.safeParse({ country: 'US', ...bad }).success, false, JSON.stringify(bad));
    }
    assert.equal(events.safeParse({}).success, false); // country is required
  });
});

describe('createCache', () => {
  it('serves cached values, shares in-flight loads and expires', async () => {
    let clock = 0;
    let loads = 0;
    const cache = createCache({ ttlMs: 100, now: () => clock });
    const load = async () => ++loads;
    const [a, b] = await Promise.all([cache.getOrLoad('k', load), cache.getOrLoad('k', load)]);
    assert.deepEqual([a, b, loads], [1, 1, 1]);
    assert.equal(await cache.getOrLoad('k', load), 1);
    clock = 101;
    assert.equal(await cache.getOrLoad('k', load), 2);
  });

  it('does not cache failures and evicts the oldest entry beyond its limit', async () => {
    const cache = createCache({ ttlMs: 1000, maxEntries: 2 });
    await assert.rejects(
      cache.getOrLoad('bad', async () => {
        throw new Error('x');
      }),
    );
    assert.equal(await cache.getOrLoad('bad', async () => 'ok'), 'ok');
    await cache.getOrLoad('a', async () => 1);
    await cache.getOrLoad('b', async () => 2);
    assert.equal(await cache.getOrLoad('bad', async () => 'reloaded'), 'reloaded');
  });
});

describe('Calendarific service', () => {
  const make = (fetchImpl) => createCalendarificService({ apiKey: KEY, baseUrl: 'https://cal.test/api/v2', fetchImpl });

  it('asks for a whole year once and caches it', async () => {
    const urls = [];
    const service = make(async (url) => {
      urls.push(String(url));
      return json(holidayPayload);
    });
    assert.equal((await service.getHolidays({ country: 'IN', year: 2027 })).length, 2);
    await service.getHolidays({ country: 'IN', year: 2027 });
    assert.equal(urls.length, 1);
    const url = new URL(urls[0]);
    assert.equal(url.pathname, '/api/v2/holidays');
    assert.equal(url.searchParams.get('country'), 'IN');
    assert.equal(url.searchParams.get('year'), '2027');
    assert.equal(url.searchParams.get('api_key'), KEY);
  });

  it('turns failures into generic errors that never contain the key', async () => {
    const cases = [
      async () => {
        throw new Error(`boom ${KEY}`);
      },
      async () => json({}, 401),
      async () => json({ meta: { code: 429, error_detail: KEY } }),
      async () => new Response('not json'),
    ];
    for (const fetchImpl of cases) {
      await assert.rejects(
        make(fetchImpl).getHolidays({ country: 'IN', year: 2027 }),
        (e) => e instanceof UpstreamError && !e.message.includes(KEY),
      );
    }
  });

  it('is unavailable without a key and never calls out', async () => {
    const service = createCalendarificService({
      apiKey: '',
      baseUrl: 'https://cal.test',
      fetchImpl: async () => assert.fail('no call'),
    });
    assert.equal(service.available, false);
    await assert.rejects(service.getHolidays({ country: 'IN', year: 2027 }), UpstreamError);
  });
});

describe('Ticketmaster service', () => {
  const query = {
    country: 'US',
    city: 'Austin',
    keyword: 'rock & roll',
    category: 'music',
    from: '2026-11-01',
    to: '2026-11-30',
  };
  const make = (fetchImpl) =>
    createTicketmasterService({ apiKey: KEY, baseUrl: 'https://tm.test/discovery/v2', fetchImpl });

  it('builds a safe, encoded query and caches identical searches', async () => {
    const urls = [];
    const service = make(async (url) => {
      urls.push(String(url));
      return json(eventPayload);
    });
    assert.equal((await service.searchEvents(query)).length, 2);
    await service.searchEvents(query);
    assert.equal(urls.length, 1);

    const url = new URL(urls[0]);
    assert.equal(url.pathname, '/discovery/v2/events.json');
    assert.equal(url.searchParams.get('keyword'), 'rock & roll');
    assert.equal(url.searchParams.get('classificationName'), 'Music');
    assert.equal(url.searchParams.get('startDateTime'), '2026-11-01T00:00:00Z');
    assert.equal(url.searchParams.get('endDateTime'), '2026-11-30T23:59:59Z');
    assert.equal(url.searchParams.get('apikey'), KEY);
  });

  it('returns an empty list when nothing matches', async () => {
    assert.deepEqual(await make(async () => json({ page: { totalElements: 0 } })).searchEvents(query), []);
  });

  it('maps failures to generic errors without the key', async () => {
    for (const fetchImpl of [
      async () => json({}, 401),
      async () => json({}, 429),
      async () => {
        throw new Error(KEY);
      },
    ]) {
      await assert.rejects(
        make(fetchImpl).searchEvents(query),
        (e) => e instanceof UpstreamError && !e.message.includes(KEY),
      );
    }
  });
});

describe('Explore API', () => {
  const servers = [];
  const boot = async (options) => {
    const server = await startServer(options);
    servers.push(server);
    return server;
  };
  after(() => Promise.all(servers.map((s) => s.close())));

  const holidays = normalizeHolidays(holidayPayload);
  const events = normalizeEvents(eventPayload);

  it('lists festivals, filtering by month, and passes validated values on', async () => {
    const calendarific = fakeCalendarific(holidays);
    const s = await boot({ calendarific });
    const all = await s.request('/api/explore/festivals?country=IN&year=2027');
    assert.equal(all.status, 200);
    assert.equal(all.json.holidays.length, 2);
    const march = await s.request('/api/explore/festivals?country=IN&year=2027&month=3');
    assert.deepEqual(
      march.json.holidays.map((h) => h.name),
      ['Holi'],
    );
    assert.deepEqual(calendarific.calls[0], { country: 'IN', year: 2027 });
  });

  it('searches events and returns the cards', async () => {
    const ticketmaster = fakeTicketmaster(events);
    const s = await boot({ ticketmaster });
    const res = await s.request(
      '/api/explore/events?country=US&city=Austin&category=music&from=2026-11-01&to=2026-11-30',
    );
    assert.equal(res.status, 200);
    assert.equal(res.json.events[0].name, 'Rock Night');
    assert.deepEqual(ticketmaster.calls[0], {
      country: 'US',
      city: 'Austin',
      category: 'music',
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });

  it('rejects bad queries before calling anything', async () => {
    const ticketmaster = fakeTicketmaster(events);
    const calendarific = fakeCalendarific(holidays);
    const s = await boot({ ticketmaster, calendarific });
    for (const path of [
      '/api/explore/events?country=XX',
      '/api/explore/events',
      '/api/explore/events?country=US&city=%3Cscript%3E',
      '/api/explore/events?country=US&from=2020-01-01',
      '/api/explore/festivals?country=IN&year=1900',
      '/api/explore/festivals?country=IN&extra=1',
    ]) {
      const res = await s.request(path);
      assert.equal(res.status, 400, path);
      assert.equal(res.json.error.code, 'validation_error');
    }
    assert.equal(ticketmaster.calls.length + calendarific.calls.length, 0);
  });

  it('answers 503 when a key is missing and 502 when the provider fails, without leaking details', async () => {
    const off = await boot({
      calendarific: fakeCalendarific([], { available: false }),
      ticketmaster: fakeTicketmaster([], { available: false }),
    });
    assert.equal((await off.request('/api/explore/festivals?country=IN')).status, 503);
    assert.equal((await off.request('/api/explore/events?country=US')).status, 503);

    const broken = await boot({
      calendarific: fakeCalendarific([], { fail: true }),
      ticketmaster: fakeTicketmaster([], { fail: true }),
    });
    for (const path of ['/api/explore/festivals?country=IN', '/api/explore/events?country=US']) {
      const res = await broken.request(path);
      assert.equal(res.status, 502);
      assert.ok(!res.text.includes('status 500'));
    }
  });

  it('reports which Explore features are configured, and lists countries', async () => {
    const s = await boot({ calendarific: fakeCalendarific([], { available: false }) });
    assert.deepEqual((await s.request('/api/health')).json.explore, { festivals: false, events: true });
    const countries = (await s.request('/api/explore/countries')).json.countries;
    assert.equal(countries.IN, 'India');
  });

  it('has its own rate limit and does not cache responses', async () => {
    const s = await boot({ env: { RATE_LIMIT_EXPLORE_PER_MIN: '2' }, calendarific: fakeCalendarific(holidays) });
    const first = await s.request('/api/explore/festivals?country=IN&year=2027');
    assert.equal(first.headers.get('cache-control'), 'no-store');
    const codes = [first.status];
    for (let i = 0; i < 2; i += 1) codes.push((await s.request('/api/explore/festivals?country=IN&year=2027')).status);
    assert.deepEqual(codes, [200, 200, 429]);
  });

  it("allows only Ticketmaster's image host (besides self and data:) in the content security policy", async () => {
    const s = await boot();
    const csp = (await s.request('/')).headers.get('content-security-policy');
    assert.match(csp, /img-src 'self' data: https:\/\/\*\.ticketm\.net(;|$)/);
    assert.match(csp, /script-src 'self'(;|$)/);
  });
});
