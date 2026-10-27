import { byId, el } from './dom.js';
import { icon } from './icons.js';

export const PANELS = [
  { id: 'overview', label: 'Overview', icon: 'layout' },
  { id: 'budget', label: 'Budget', icon: 'pie' },
  { id: 'timeline', label: 'Timeline', icon: 'calendar' },
  { id: 'checklist', label: 'Checklist', icon: 'checklist' },
  { id: 'dates', label: 'Dates to know', icon: 'star' },
  { id: 'ideas', label: 'Ideas', icon: 'bulb' },
  { id: 'card', label: 'Invitation card', icon: 'image' },
  { id: 'assistant', label: 'Assistant', icon: 'chat' },
];

const LAST = PANELS.length - 1;
const ARROW_STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** One tab button per panel (WAI-ARIA tabs pattern). `onSelect(i)` runs when a tab is clicked. */
function buildTabs(onSelect) {
  const tabs = PANELS.map((panel, i) => {
    const tab = el(
      'button',
      { type: 'button', role: 'tab', id: `tab-${panel.id}`, 'aria-controls': `panel-${panel.id}`, className: 'tab' },
      el('span', { className: 'tab-icon' }, icon(panel.icon, { size: 20 })),
      el('span', { className: 'tab-text' }, el('small', { text: `Step ${i + 1}` }), el('span', { text: panel.label })),
      el('span', { className: 'tab-done' }, icon('check', { size: 14 })),
    );
    tab.addEventListener('click', () => onSelect(i));
    return tab;
  });
  byId('ws-tabs').replaceChildren(...tabs);
  return tabs;
}

/** The "Step 3 of 8" text and the progress bar. */
function createProgress() {
  const text = byId('ws-progress-text');
  const bar = document.querySelector('.progress-bar');
  const fill = byId('ws-progress-fill');
  return {
    set(step, message) {
      text.textContent = message;
      bar.setAttribute('aria-valuenow', String(step));
      bar.setAttribute('aria-valuetext', message);
      fill.className = `fill-${step}`;
    },
  };
}

/** Which step a key on the tab list should move to, or null if the key does nothing. */
function stepForKey(key, current) {
  if (key in ARROW_STEP) return (current + ARROW_STEP[key] + PANELS.length) % PANELS.length;
  if (key === 'Home') return 0;
  if (key === 'End') return LAST;
  return null;
}

/**
 * The step-by-step workspace: a tab list (one panel visible at a time) with Back/Next buttons,
 * a progress bar and arrow-key navigation. The last step's button says "All done".
 */
export function setupWorkspace() {
  const buttons = { prev: byId('prev-step'), next: byId('next-step') };
  const labels = { prev: byId('prev-label'), next: byId('next-label') };
  const finishPanel = byId('panel-finish');
  const panelNav = byId('panel-nav');
  const progress = createProgress();
  const visited = new Set();
  const tabs = buildTabs((i) => go(i));
  let index = 0;

  function go(next, { scroll = false } = {}) {
    index = Math.max(0, Math.min(LAST, next));
    visited.add(index);
    finishPanel.hidden = true;
    panelNav.hidden = false;

    PANELS.forEach((panel, i) => {
      const active = i === index;
      byId(`panel-${panel.id}`).hidden = !active;
      tabs[i].setAttribute('aria-selected', String(active));
      tabs[i].tabIndex = active ? 0 : -1;
      tabs[i].classList.toggle('done', visited.has(i) && !active);
    });
    tabs[index].scrollIntoView({ block: 'nearest', inline: 'nearest' }); // keeps the active tab visible on phones

    progress.set(index + 1, `Step ${index + 1} of ${PANELS.length}: ${PANELS[index].label}`);
    buttons.prev.disabled = index === 0;
    labels.prev.textContent = index === 0 ? 'Back' : `Back: ${PANELS[index - 1].label}`;
    labels.next.textContent = index === LAST ? 'All done' : `Next: ${PANELS[index + 1].label}`;

    if (scroll) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      byId('results-heading').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /** The last step's "All done": shows the finish screen with what to do next. */
  function finish() {
    for (const panel of PANELS) byId(`panel-${panel.id}`).hidden = true;
    panelNav.hidden = true;
    finishPanel.hidden = false;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = i === 0 ? 0 : -1;
      tab.classList.add('done');
    });
    progress.set(PANELS.length, 'All steps complete');
    byId('results-heading').scrollIntoView({ block: 'start' });
    finishPanel.focus({ preventScroll: true });
  }

  buttons.prev.addEventListener('click', () => go(index - 1, { scroll: true }));
  buttons.next.addEventListener('click', () => (index === LAST ? finish() : go(index + 1, { scroll: true })));
  byId('finish-review').addEventListener('click', () => go(0, { scroll: true }));

  byId('ws-tabs').addEventListener('keydown', (event) => {
    const target = stepForKey(event.key, index);
    if (target === null) return;
    event.preventDefault();
    go(target);
    tabs[target].focus();
  });

  return {
    go,
    /** Starts again at the first step (called when a new plan arrives). */
    reset() {
      visited.clear();
      go(0);
    },
  };
}
