import { donut, ring } from './charts.js';
import { el } from './dom.js';
import { daysLabel, formatDate, formatINR } from './format.js';
import { CATEGORY_ICON, icon } from './icons.js';

const STATUS = {
  comfortable: { text: 'Comfortable', icon: 'shield' },
  tight: { text: 'Tight', icon: 'alert' },
  insufficient: { text: 'Too low', icon: 'alert' },
};
const EVENT_ICON = { wedding: 'heart', birthday: 'cake', community: 'users', public: 'megaphone' };
const PRIORITY_TEXT = { must: 'Must do', should: 'Should do', nice: 'Nice to have' };

const tile = (iconName, label, value, className = '') =>
  el(
    'div',
    { className: `stat ${className}`.trim() },
    el('span', { className: 'stat-icon' }, icon(iconName, { size: 22 })),
    el('div', {}, el('p', { className: 'stat-label', text: label }), el('p', { className: 'stat-value', text: value })),
  );

/** Overview tiles and advice for the first workspace step. */
export function renderSummary(plan) {
  const { summary, feasibility } = plan;
  const status = STATUS[feasibility.status];
  return {
    tiles: [
      tile(EVENT_ICON[summary.eventType], 'Event', summary.eventLabel),
      tile('calendar', 'Date', formatDate(summary.eventDate)),
      tile('clock', 'Time to go', daysLabel(summary.daysLeft)),
      tile('users', 'Guests', summary.guests.toLocaleString('en-IN')),
      tile('wallet', 'Total budget', formatINR(summary.budget)),
      tile('rupee', 'Per guest', formatINR(feasibility.perGuest)),
      tile(status.icon, 'Budget check', status.text, `status-${feasibility.status}`),
    ],
    advice: feasibility.advice.map((line) => el('li', { text: line })),
  };
}

export function renderBudget({ budget }) {
  const segments = [...budget.allocations.map((a) => ({ label: a.label, value: a.amount })), { label: 'Contingency reserve', value: budget.contingency.amount }];
  const chart = donut(segments, {
    centre: [formatINR(budget.total), 'total budget'],
    label: `Budget split: ${segments.map((s) => `${s.label} ${formatINR(s.value)}`).join(', ')}`,
  });

  const row = (index, label, iconName, percent, amount, extra) =>
    el(
      'tr',
      {},
      el(
        'th',
        { scope: 'row' },
        el('span', { className: `swatch seg-bg-${(index % 9) + 1}` }),
        el('span', { className: 'row-icon' }, icon(iconName, { size: 18 })),
        label,
        extra,
      ),
      el('td', { className: 'num', text: `${percent}%` }),
      el('td', { className: 'num', text: formatINR(amount) }),
    );

  const rows = budget.allocations.map((a, i) =>
    row(i, a.label, CATEGORY_ICON[a.category], a.percent, a.amount, a.priority && el('span', { className: 'badge badge-priority', text: 'Priority' })),
  );
  rows.push(row(budget.allocations.length, 'Contingency reserve', 'shield', budget.contingency.percent, budget.contingency.amount));

  return el(
    'div',
    { className: 'budget-layout' },
    el('div', { className: 'chart-box' }, chart),
    el(
      'div',
      { className: 'table-wrap' },
      el(
        'table',
        {},
        el('caption', { text: 'Suggested spend by category. The reserve covers surprises such as extra guests or price changes.' }),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', className: 'num', text: 'Share' }), el('th', { scope: 'col', className: 'num', text: 'Amount' }))),
        el('tbody', {}, rows),
        el('tfoot', {}, el('tr', {}, el('th', { scope: 'row', colspan: 2, text: 'Total' }), el('td', { className: 'num', text: formatINR(budget.total) }))),
      ),
    ),
  );
}

export function renderTimeline({ timeline }) {
  const note = timeline.compressed
    ? el('p', { className: 'callout', role: 'note' }, icon('alert', { size: 18 }), ' Your date is closer than the ideal lead time, so the steps are squeezed together. Start with the earliest ones today.')
    : null;
  const items = timeline.milestones.map((m) =>
    el(
      'li',
      { className: 'milestone' },
      el('span', { className: 'milestone-dot', 'aria-hidden': 'true' }),
      el('h4', { text: m.title }),
      el('time', { datetime: m.date, text: `${formatDate(m.date)} · ${m.daysBefore === 0 ? 'event day' : `${daysLabel(m.daysBefore)} before`}` }),
      el('ul', {}, m.tasks.map((task) => el('li', { text: task }))),
    ),
  );
  return [note, el('ol', { className: 'timeline' }, items)];
}

/** `checked` is a Set of item ids; `onToggle(id, isChecked)` runs on change. */
export function renderChecklist({ checklist }, checked, onToggle) {
  return checklist.map((group, index) => {
    const headingId = `check-group-${index}`;
    return el(
      'section',
      { className: 'checklist-group', 'aria-labelledby': headingId },
      el(
        'h4',
        { id: headingId },
        el('span', { className: 'row-icon' }, icon(CATEGORY_ICON[group.category], { size: 18 })),
        `${group.label} `,
        el('span', { className: 'hint', text: `· budget ${formatINR(group.allocation)}` }),
      ),
      el(
        'ul',
        { className: 'checklist-items' },
        group.items.map((item) => {
          const box = el('input', { type: 'checkbox', id: `item-${item.id}` });
          box.checked = checked.has(item.id);
          box.addEventListener('change', () => onToggle(item.id, box.checked));
          const when = item.urgent ? 'do this now' : `book by ${formatDate(item.bookBy)}`;
          return el(
            'li',
            {},
            el(
              'label',
              {},
              box,
              el(
                'span',
                { className: 'task' },
                item.task,
                el('span', { className: 'by' }, el('span', { className: `pill pill-${item.priority}`, text: PRIORITY_TEXT[item.priority] }), item.urgent ? el('strong', { className: 'urgent', text: ` ${when}` }) : ` ${when}`),
              ),
            ),
          );
        }),
      ),
    );
  });
}

export function renderChecklistRing(done, total) {
  return ring(done, total, { label: `${done} of ${total} checklist items done` });
}

const listCard = (iconName, title, items) =>
  el('div', { className: 'idea-card' }, el('h4', {}, el('span', { className: 'row-icon' }, icon(iconName, { size: 18 })), title), el('ul', {}, items.map((i) => el('li', { text: i }))));

export function renderIdeas(ideas) {
  const source =
    ideas.source === 'ai'
      ? el('p', { className: 'source' }, icon('sparkles', { size: 16 }), ' Personalised by AI from your answers.')
      : el('p', { className: 'source' }, icon('bulb', { size: 16 }), ' Built-in ideas (the AI service is not available right now).');
  return [
    source,
    el(
      'div',
      { className: 'ideas-grid' },
      el(
        'div',
        { className: 'idea-card' },
        el('h4', {}, el('span', { className: 'row-icon' }, icon('sparkles', { size: 18 })), 'Themes'),
        el('ul', {}, ideas.themes.map((t) => el('li', {}, el('strong', { text: t.title }), ` – ${t.description}`))),
      ),
      listCard('utensils', 'Menu ideas', ideas.menu),
      listCard('music', 'Entertainment', ideas.entertainment),
      listCard('wallet', 'Ways to save', ideas.budgetTips),
    ),
    ideas.personalTouch && el('p', { className: 'callout' }, icon('heart', { size: 18 }), el('span', {}, el('strong', { text: ' Personal touch: ' }), ideas.personalTouch)),
  ];
}

const offsetLabel = (offset) => {
  if (offset === 0) return 'On your date';
  const days = Math.abs(offset);
  return `${days} ${days === 1 ? 'day' : 'days'} ${offset < 0 ? 'before' : 'after'}`;
};

export function renderDates({ nearby, weekday, advice }) {
  const cards =
    nearby.length > 0
      ? nearby.map((e) =>
          el(
            'li',
            { className: 'date-card' },
            el('p', { className: 'date-card-name', text: e.name }),
            el('p', { className: 'hint', text: `${formatDate(e.date)} · ${offsetLabel(e.offset)}` }),
            el('span', { className: 'badge', text: e.kind === 'public' ? 'Public holiday' : 'Festival or observance' }),
            e.tentative && el('span', { className: 'badge badge-urgent', text: 'Date may change' }),
          ),
        )
      : [
          el(
            'li',
            { className: 'date-card' },
            el('p', { className: 'hint', text: `Your date is a ${weekday}, with no major holidays or festivals within a week.` }),
          ),
        ];
  return { cards, advice: advice.map((line) => el('li', { text: line })) };
}
