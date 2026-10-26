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

/**
 * The step-by-step workspace: a tab list (one panel visible at a time) with Back/Next buttons,
 * a progress bar and arrow-key navigation, following the WAI-ARIA tabs pattern.
 */
export function setupWorkspace() {
  const tabList = byId('ws-tabs');
  const progressText = byId('ws-progress-text');
  const progressBar = document.querySelector('.progress-bar');
  const progressFill = byId('ws-progress-fill');
  const prevButton = byId('prev-step');
  const nextButton = byId('next-step');
  const prevLabel = byId('prev-label');
  const nextLabel = byId('next-label');
  const finishPanel = byId('panel-finish');
  const panelNav = byId('panel-nav');
  const visited = new Set();
  let index = 0;

  const tabs = PANELS.map((panel, i) => {
    const tab = el(
      'button',
      {
        type: 'button',
        role: 'tab',
        id: `tab-${panel.id}`,
        'aria-controls': `panel-${panel.id}`,
        className: 'tab',
      },
      el('span', { className: 'tab-icon' }, icon(panel.icon, { size: 20 })),
      el('span', { className: 'tab-text' }, el('small', { text: `Step ${i + 1}` }), el('span', { text: panel.label })),
      el('span', { className: 'tab-done' }, icon('check', { size: 14 })),
    );
    tab.addEventListener('click', () => go(i));
    return tab;
  });
  tabList.replaceChildren(...tabs);

  function go(next, { scroll = false } = {}) {
    index = Math.max(0, Math.min(PANELS.length - 1, next));
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

    tabs[index].scrollIntoView({ block: 'nearest', inline: 'nearest' }); // keeps the active tab visible in the mobile strip

    const step = index + 1;
    progressText.textContent = `Step ${step} of ${PANELS.length}: ${PANELS[index].label}`;
    progressBar.setAttribute('aria-valuenow', String(step));
    progressBar.setAttribute('aria-valuetext', progressText.textContent);
    progressFill.className = `fill-${step}`;

    prevButton.disabled = index === 0;
    nextButton.disabled = false; // on the last step this becomes "All done"
    prevLabel.textContent = index === 0 ? 'Back' : `Back: ${PANELS[index - 1].label}`;
    nextLabel.textContent = index === PANELS.length - 1 ? 'All done' : `Next: ${PANELS[index + 1].label}`;

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
    progressText.textContent = 'All steps complete';
    progressBar.setAttribute('aria-valuenow', String(PANELS.length));
    progressBar.setAttribute('aria-valuetext', 'All steps complete');
    progressFill.className = `fill-${PANELS.length}`;
    byId('results-heading').scrollIntoView({ block: 'start' });
    finishPanel.focus({ preventScroll: true });
  }

  prevButton.addEventListener('click', () => go(index - 1, { scroll: true }));
  nextButton.addEventListener('click', () => (index === PANELS.length - 1 ? finish() : go(index + 1, { scroll: true })));
  byId('finish-review').addEventListener('click', () => go(0, { scroll: true }));

  tabList.addEventListener('keydown', (event) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let target = null;
    if (event.key in keys) target = (index + keys[event.key] + PANELS.length) % PANELS.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = PANELS.length - 1;
    if (target === null) return;
    event.preventDefault();
    go(target);
    tabs[target].focus();
  });

  /** Starts again at the first step (called when a new plan arrives). */
  function reset() {
    visited.clear();
    go(0);
  }

  return { go, reset };
}
