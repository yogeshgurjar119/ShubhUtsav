import { ApiError, getJson } from './api.js';
import { byId } from './dom.js';
import { todayPlus } from './format.js';
import { MONTHS, eventsView, festivalsView } from './exploreRender.js';

const TABS = ['festivals', 'events'];
const FALLBACK_COUNTRIES = { IN: 'India', US: 'United States', GB: 'United Kingdom' };
const MISSING_KEY = {
  festivals: 'Festival data is not set up on this server yet (a Calendarific key is needed).',
  events: 'Event listings are not set up on this server yet (a Ticketmaster key is needed).',
};

/** The two Explore tabs (festivals, events): selection, arrow-key navigation and which panel shows. */
function createTabs(onChange) {
  const tabs = Object.fromEntries(TABS.map((name) => [name, byId(`xtab-${name}`)]));
  const panels = Object.fromEntries(TABS.map((name) => [name, byId(`xpanel-${name}`)]));
  let active = 'festivals';

  function select(name, { focus = false } = {}) {
    active = name;
    for (const tab of TABS) {
      const on = tab === name;
      tabs[tab].setAttribute('aria-selected', String(on));
      tabs[tab].tabIndex = on ? 0 : -1;
      panels[tab].hidden = !on;
    }
    if (focus) tabs[name].focus();
    onChange(name);
  }

  const step = (key) => {
    const index = TABS.indexOf(active);
    if (key === 'Home') return 0;
    if (key === 'End') return TABS.length - 1;
    return (index + (key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
  };

  for (const name of TABS) tabs[name].addEventListener('click', () => select(name));
  byId('explore-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    select(TABS[step(event.key)], { focus: true });
  });

  return { select, active: () => active };
}

/** Fills the country, year and month pickers, and keeps the date limits in step with "today". */
function createFilters() {
  const thisYear = Number(todayPlus(0).slice(0, 4));
  byId('f-year').replaceChildren(...[0, 1, 2, 3].map((n) => new Option(String(thisYear + n), String(thisYear + n))));
  byId('f-month').replaceChildren(
    new Option('Whole year', ''),
    ...MONTHS.map((name, index) => new Option(name, String(index + 1))),
  );
  byId('f-month').value = String(Number(todayPlus(0).slice(5, 7)));

  function refreshDates() {
    const today = todayPlus(0);
    for (const id of ['e-from', 'e-to']) byId(id).min = today;
    if (!byId('e-from').value || byId('e-from').value < today) byId('e-from').value = today;
    if (!byId('e-to').value || byId('e-to').value < today) byId('e-to').value = todayPlus(1);
  }
  refreshDates();

  function setCountries(countries) {
    const options = (selected) =>
      Object.entries(countries).map(([code, name]) => new Option(name, code, false, code === selected));
    byId('f-country').replaceChildren(...options('IN'));
    byId('e-country').replaceChildren(...options('US'));
  }

  return { refreshDates, setCountries };
}

/**
 * The Explore panel: festivals and holidays (Calendarific) and live events (Ticketmaster).
 * `getHealth()` tells us which sources the server has keys for; `onUseDate(iso)` is called when
 * someone picks a date to plan an event on.
 */
export function setupExplore({ getHealth, onUseDate }) {
  const status = byId('explore-status');
  const results = byId('explore-results');
  const filters = createFilters();
  let countries = null;
  let features = null;

  const noteMissingKey = (tab) => {
    if (features && !features[tab]) status.textContent = MISSING_KEY[tab];
  };
  const tabs = createTabs((tab) => {
    results.replaceChildren();
    status.textContent = '';
    noteMissingKey(tab);
  });

  const actions = () => ({ countries, onUseDate, isPast: (iso) => iso < todayPlus(0) });

  /** Runs a search, shows "Loading…", and renders the result or the error message. */
  async function search(label, request, buildView) {
    results.replaceChildren();
    status.textContent = `Loading ${label}…`;
    try {
      const { message, nodes } = buildView(await request());
      status.textContent = message;
      results.replaceChildren(...nodes);
    } catch (error) {
      status.textContent = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
    }
  }

  byId('festival-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const params = { country: byId('f-country').value, year: byId('f-year').value, month: byId('f-month').value };
    search(
      'festivals',
      () => getJson('/api/explore/festivals', params),
      (data) => festivalsView(data, actions()),
    );
  });

  byId('events-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const params = {
      country: byId('e-country').value,
      city: byId('e-city').value.trim(),
      keyword: byId('e-keyword').value.trim(),
      category: byId('e-category').value,
      from: byId('e-from').value,
      to: byId('e-to').value,
    };
    search(
      'events',
      () => getJson('/api/explore/events', params),
      (data) => eventsView(data, actions()),
    );
  });

  async function loadCountries() {
    if (countries) return;
    try {
      countries = (await getJson('/api/explore/countries')).countries;
    } catch {
      countries = FALLBACK_COUNTRIES;
    }
    filters.setCountries(countries);
  }

  return {
    refreshDates: filters.refreshDates,
    /** Called every time the Explore view is shown. */
    async open() {
      await loadCountries();
      features = (await getHealth())?.explore ?? { festivals: false, events: false };
      noteMissingKey(tabs.active());
    },
  };
}
