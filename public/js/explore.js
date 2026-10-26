import { ApiError, getJson } from './api.js';
import { byId, el } from './dom.js';
import { formatDate, localToday } from './format.js';
import { icon } from './icons.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TABS = ['festivals', 'events'];

const hasDatePassed = (iso) => iso < localToday();

/**
 * The Explore panel: festivals and holidays (Calendarific) and live events (Ticketmaster).
 * `getHealth()` tells us which sources the server has keys for; `onUseDate(iso)` is called when
 * someone picks a date to plan an event on.
 */
export function setupExplore({ getHealth, onUseDate }) {
  const status = byId('explore-status');
  const results = byId('explore-results');
  const tabs = Object.fromEntries(TABS.map((name) => [name, byId(`xtab-${name}`)]));
  const panels = Object.fromEntries(TABS.map((name) => [name, byId(`xpanel-${name}`)]));
  let active = 'festivals';
  let countries = null;
  let loadedCountries = false;

  /* ---------- tabs ---------- */
  function selectTab(name, { focus = false } = {}) {
    active = name;
    for (const tab of TABS) {
      const on = tab === name;
      tabs[tab].setAttribute('aria-selected', String(on));
      tabs[tab].tabIndex = on ? 0 : -1;
      panels[tab].hidden = !on;
    }
    results.replaceChildren();
    status.textContent = '';
    if (focus) tabs[name].focus();
    maybeNoteMissingKey();
  }
  for (const name of TABS) tabs[name].addEventListener('click', () => selectTab(name));
  byId('explore-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.indexOf(active);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    selectTab(TABS[next], { focus: true });
  });

  /* ---------- setup of the form controls ---------- */
  async function loadCountries() {
    if (loadedCountries) return;
    loadedCountries = true;
    try {
      countries = (await getJson('/api/explore/countries')).countries;
    } catch {
      countries = { IN: 'India', US: 'United States', GB: 'United Kingdom' };
    }
    const options = (selected) => Object.entries(countries).map(([code, name]) => new Option(name, code, false, code === selected));
    byId('f-country').replaceChildren(...options('IN'));
    byId('e-country').replaceChildren(...options('US'));
  }

  function setupFilters() {
    const thisYear = new Date().getFullYear();
    byId('f-year').replaceChildren(...[0, 1, 2, 3].map((n) => new Option(String(thisYear + n), String(thisYear + n))));
    byId('f-month').replaceChildren(new Option('Whole year', ''), ...MONTHS.map((m, i) => new Option(m, String(i + 1))));
    byId('f-month').value = String(new Date().getMonth() + 1);
    byId('e-from').min = localToday();
    byId('e-from').value = localToday();
    byId('e-to').min = localToday();
    byId('e-to').value = localToday(1);
  }
  setupFilters();

  /* ---------- helpers ---------- */
  let health = null;
  function maybeNoteMissingKey() {
    if (!health) return;
    const on = active === 'festivals' ? health.festivals : health.events;
    if (!on) {
      status.textContent = active === 'festivals' ? 'Festival data is not set up on this server yet (a Calendarific key is needed).' : 'Event listings are not set up on this server yet (a Ticketmaster key is needed).';
    }
  }

  async function run(label, request) {
    results.replaceChildren();
    status.textContent = `Loading ${label}…`;
    try {
      const data = await request();
      status.textContent = '';
      return data;
    } catch (error) {
      status.textContent = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
      return null;
    }
  }

  const useDateButton = (iso) => {
    const button = el('button', { type: 'button', className: 'button button-secondary button-small' }, icon('calendar', { size: 16 }), ' Plan an event on this date');
    if (hasDatePassed(iso)) button.disabled = true;
    button.addEventListener('click', () => onUseDate(iso));
    return button;
  };

  /* ---------- festivals ---------- */
  function renderFestivals({ holidays, country, year, month }) {
    if (holidays.length === 0) {
      status.textContent = 'No festivals or holidays found for that choice.';
      return;
    }
    const byMonth = new Map();
    for (const holiday of holidays) {
      const key = Number(holiday.date.slice(5, 7));
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(holiday);
    }
    status.textContent = `${holidays.length} festivals and holidays in ${countries?.[country] ?? country}, ${month ? `${MONTHS[month - 1]} ` : ''}${year}.`;

    const groups = [...byMonth.entries()].map(([m, list]) =>
      el(
        'section',
        { className: 'explore-month', 'aria-label': MONTHS[m - 1] },
        el('h3', { text: MONTHS[m - 1] }),
        el(
          'ul',
          { className: 'explore-list' },
          list.map((h) => {
            const day = Number(h.date.slice(8, 10));
            return el(
              'li',
              { className: 'explore-card' },
              el('div', { className: 'date-block', 'aria-hidden': 'true' }, el('strong', { text: String(day) }), el('span', { text: MONTHS[m - 1].slice(0, 3) })),
              el(
                'div',
                { className: 'explore-body' },
                el('h4', { text: h.name }),
                el('p', { className: 'hint', text: formatDate(h.date) }),
                h.description && el('p', { className: 'explore-desc', text: h.description }),
                el('div', { className: 'badges' }, h.types.map((t) => el('span', { className: 'badge', text: t }))),
                useDateButton(h.date),
              ),
            );
          }),
        ),
      ),
    );
    results.replaceChildren(...groups);
  }

  byId('festival-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = await run('festivals', () =>
      getJson('/api/explore/festivals', { country: byId('f-country').value, year: byId('f-year').value, month: byId('f-month').value }),
    );
    if (data) renderFestivals(data);
  });

  /* ---------- live events ---------- */
  const priceText = (e) => {
    if (e.priceMin === null) return '';
    const fmt = (n) => new Intl.NumberFormat('en', { style: 'currency', currency: e.currency || 'USD', maximumFractionDigits: 0 }).format(n);
    return e.priceMax && e.priceMax !== e.priceMin ? `${fmt(e.priceMin)} – ${fmt(e.priceMax)}` : fmt(e.priceMin);
  };

  function renderEvents({ events, country }) {
    if (events.length === 0) {
      status.textContent =
        country === 'IN'
          ? 'No live events found. Ticketmaster has limited listings in India, so try the Festivals tab or another country.'
          : 'No events found for that search. Try a wider date range or fewer filters.';
      return;
    }
    status.textContent = `${events.length} events found.`;
    results.replaceChildren(
      el(
        'ul',
        { className: 'explore-list events' },
        events.map((e) => {
          const place = [e.venue, e.city].filter(Boolean).join(', ');
          const when = `${formatDate(e.date)}${e.time ? ` · ${e.time}` : ''}`;
          const link = e.url
            ? el('a', { className: 'button button-secondary button-small', href: e.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', { size: 16 }), ' Tickets', el('span', { className: 'visually-hidden', text: ' (opens in a new tab)' }))
            : null;
          return el(
            'li',
            { className: 'explore-card event-card' },
            e.image && el('img', { src: e.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', className: 'event-image' }),
            el(
              'div',
              { className: 'explore-body' },
              el('h4', { text: e.name }),
              el('p', { className: 'hint' }, icon('calendar', { size: 14 }), ` ${when}`),
              place && el('p', { className: 'hint' }, icon('pin', { size: 14 }), ` ${place}`),
              el(
                'div',
                { className: 'badges' },
                [e.category, e.genre, priceText(e), e.status && e.status !== 'onsale' ? e.status : ''].filter(Boolean).map((t) => el('span', { className: 'badge', text: t })),
              ),
              el('div', { className: 'button-row' }, useDateButton(e.date), link),
            ),
          );
        }),
      ),
    );
  }

  byId('events-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = await run('events', () =>
      getJson('/api/explore/events', {
        country: byId('e-country').value,
        city: byId('e-city').value.trim(),
        keyword: byId('e-keyword').value.trim(),
        category: byId('e-category').value,
        from: byId('e-from').value,
        to: byId('e-to').value,
      }),
    );
    if (data) renderEvents(data);
  });

  /** Called every time the Explore view is shown. */
  async function open() {
    await loadCountries();
    health = (await getHealth())?.explore ?? { festivals: false, events: false };
    maybeNoteMissingKey();
  }

  return { open };
}
