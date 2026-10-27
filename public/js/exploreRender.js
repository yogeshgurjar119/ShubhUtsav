import { el } from './dom.js';
import { formatDate } from './format.js';
import { icon } from './icons.js';

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const badges = (labels) =>
  el(
    'div',
    { className: 'badges' },
    labels.filter(Boolean).map((label) => el('span', { className: 'badge', text: label })),
  );

/** "Plan an event on this date" button; disabled for dates that are already in the past. */
function useDateButton(iso, { onUseDate, isPast }) {
  const button = el(
    'button',
    { type: 'button', className: 'button button-secondary button-small' },
    icon('calendar', { size: 16 }),
    ' Plan an event on this date',
  );
  button.disabled = isPast(iso);
  button.addEventListener('click', () => onUseDate(iso));
  return button;
}

function holidayCard(holiday, month, actions) {
  const day = Number(holiday.date.slice(8, 10));
  return el(
    'li',
    { className: 'explore-card' },
    el(
      'div',
      { className: 'date-block', 'aria-hidden': 'true' },
      el('strong', { text: String(day) }),
      el('span', { text: MONTHS[month - 1].slice(0, 3) }),
    ),
    el(
      'div',
      { className: 'explore-body' },
      el('h4', { text: holiday.name }),
      el('p', { className: 'hint', text: formatDate(holiday.date) }),
      holiday.description && el('p', { className: 'explore-desc', text: holiday.description }),
      badges(holiday.types),
      useDateButton(holiday.date, actions),
    ),
  );
}

const groupByMonth = (holidays) => {
  const groups = new Map();
  for (const holiday of holidays) {
    const month = Number(holiday.date.slice(5, 7));
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(holiday);
  }
  return groups;
};

/** Builds the festivals list. Returns `{ message, nodes }` for the status line and the results area. */
export function festivalsView({ holidays, country, year, month }, { countries, ...actions }) {
  if (holidays.length === 0) return { message: 'No festivals or holidays found for that choice.', nodes: [] };

  const place = countries?.[country] ?? country;
  const when = `${month ? `${MONTHS[month - 1]} ` : ''}${year}`;
  const nodes = [...groupByMonth(holidays)].map(([m, list]) =>
    el(
      'section',
      { className: 'explore-month', 'aria-label': MONTHS[m - 1] },
      el('h3', { text: MONTHS[m - 1] }),
      el(
        'ul',
        { className: 'explore-list' },
        list.map((holiday) => holidayCard(holiday, m, actions)),
      ),
    ),
  );
  return { message: `${holidays.length} festivals and holidays in ${place}, ${when}.`, nodes };
}

function priceText(event) {
  if (event.priceMin === null) return '';
  const money = (n) =>
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: event.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  return event.priceMax && event.priceMax !== event.priceMin
    ? `${money(event.priceMin)} – ${money(event.priceMax)}`
    : money(event.priceMin);
}

function ticketsLink(url) {
  if (!url) return null;
  return el(
    'a',
    { className: 'button button-secondary button-small', href: url, target: '_blank', rel: 'noopener noreferrer' },
    icon('external', { size: 16 }),
    ' Tickets',
    el('span', { className: 'visually-hidden', text: ' (opens in a new tab)' }),
  );
}

function eventCard(event, actions) {
  const place = [event.venue, event.city].filter(Boolean).join(', ');
  const when = `${formatDate(event.date)}${event.time ? ` · ${event.time}` : ''}`;
  const image = event.image
    ? el('img', { src: event.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', className: 'event-image' })
    : null;
  const status = event.status && event.status !== 'onsale' ? event.status : '';

  return el(
    'li',
    { className: 'explore-card event-card' },
    image,
    el(
      'div',
      { className: 'explore-body' },
      el('h4', { text: event.name }),
      el('p', { className: 'hint' }, icon('calendar', { size: 14 }), ` ${when}`),
      place && el('p', { className: 'hint' }, icon('pin', { size: 14 }), ` ${place}`),
      badges([event.category, event.genre, priceText(event), status]),
      el('div', { className: 'button-row' }, useDateButton(event.date, actions), ticketsLink(event.url)),
    ),
  );
}

const NO_EVENTS_IN_INDIA =
  'No live events found. Ticketmaster has limited listings in India, so try the Festivals tab or another country.';

/** Builds the live-events list. Returns `{ message, nodes }`. */
export function eventsView({ events, country }, actions) {
  if (events.length === 0) {
    const message =
      country === 'IN'
        ? NO_EVENTS_IN_INDIA
        : 'No events found for that search. Try a wider date range or fewer filters.';
    return { message, nodes: [] };
  }
  const list = el(
    'ul',
    { className: 'explore-list events' },
    events.map((event) => eventCard(event, actions)),
  );
  return { message: `${events.length} events found.`, nodes: [list] };
}
