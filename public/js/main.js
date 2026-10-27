import { ApiError, getHealth, postJson } from './api.js';
import { setupCard } from './card.js';
import { setupChat } from './chat.js';
import { setupExplore } from './explore.js';
import { byId } from './dom.js';
import { formatDate, setServerToday } from './format.js';
import { hydrateIcons } from './icons.js';
import {
  renderBudget,
  renderChecklist,
  renderChecklistRing,
  renderDates,
  renderIdeas,
  renderSummary,
  renderTimeline,
} from './render.js';
import { loadChecked, planKey, saveChecked } from './storage.js';
import { setupTheme } from './theme.js';
import { setupWizard } from './wizard.js';
import { setupWorkspace } from './workspace.js';

const form = byId('plan-form');
const statusLine = byId('status');
const formError = byId('form-error');
const planView = byId('view-plan');
const resultsView = byId('view-results');
const exploreView = byId('view-explore');
const restartButton = byId('restart-btn');

let aiEnabled = false;
let imageEnabled = false;
let currentEvent = null;

hydrateIcons();
setupTheme(byId('theme-btn'));
const workspace = setupWorkspace();
const chat = setupChat({ getEvent: () => currentEvent, aiAvailable: () => aiEnabled });
const card = setupCard({ getEvent: () => currentEvent, imageAvailable: () => imageEnabled });
const wizard = setupWizard({ form, onSubmit: createPlan });
const explore = setupExplore({
  getHealth,
  onUseDate(iso) {
    wizard.setDate(iso);
    showView('plan');
    wizard.go(1);
  },
});

/* ---------- errors ---------- */
function clearErrors() {
  formError.hidden = true;
  formError.textContent = '';
  for (const node of form.querySelectorAll('.field-error')) {
    node.hidden = true;
    node.textContent = '';
  }
  for (const node of form.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
}

/** Shows server-side validation messages next to the matching fields and jumps to their step. */
function showErrors(error) {
  const fieldErrors = (error.details ?? []).filter((d) => byId(`${d.field}-error`));
  for (const { field, message } of fieldErrors) {
    const target = byId(`${field}-error`);
    target.textContent = message;
    target.hidden = false;
    byId(field)?.setAttribute('aria-invalid', 'true');
  }
  formError.textContent = fieldErrors.length > 0 ? 'Please fix the highlighted details and try again.' : error.message;
  formError.hidden = false;

  if (fieldErrors.length > 0) {
    const stepOf = byId(fieldErrors[0].field)?.closest('.form-step')?.dataset.step;
    if (stepOf) wizard.go(Number(stepOf));
    byId(fieldErrors[0].field)?.focus();
  } else {
    formError.focus?.();
  }
}

function setBusy(busy) {
  const submit = byId('submit-btn');
  submit.disabled = busy;
  statusLine.textContent = busy ? 'Building your plan. AI ideas can take up to 20 seconds…' : '';
}

/* ---------- views ---------- */
function showView(name) {
  planView.hidden = name !== 'plan';
  resultsView.hidden = name !== 'results';
  exploreView.hidden = name !== 'explore';
  restartButton.hidden = name !== 'results';
  // "Plan" stays highlighted for both the setup wizard and the workspace.
  const onExplore = name === 'explore';
  byId('nav-plan').toggleAttribute('aria-current', !onExplore);
  byId('nav-explore').toggleAttribute('aria-current', onExplore);
  for (const id of ['nav-plan', 'nav-explore']) {
    const button = byId(id);
    if (button.hasAttribute('aria-current')) button.setAttribute('aria-current', 'page');
  }
}

function showPlan({ plan, ideas, dateInsights }) {
  const { tiles, advice } = renderSummary(plan);
  byId('summary').replaceChildren(...tiles);
  byId('advice').replaceChildren(...advice);
  byId('budget-view').replaceChildren(renderBudget(plan));
  byId('timeline').replaceChildren(...renderTimeline(plan).filter(Boolean));
  byId('ideas').replaceChildren(...renderIdeas(ideas).filter(Boolean));

  const dates = renderDates(dateInsights);
  byId('dates-list').replaceChildren(...dates.cards);
  byId('dates-advice').replaceChildren(...dates.advice);

  const key = planKey(plan.summary);
  const checked = loadChecked(key);
  const total = plan.checklist.reduce((n, g) => n + g.items.length, 0);
  const updateProgress = () => {
    const done = Math.min(checked.size, total);
    byId('checklist-ring').replaceChildren(renderChecklistRing(done, total));
    byId('checklist-progress').textContent = `${done} of ${total} done. Your ticks are saved on this device only.`;
  };
  byId('checklist').replaceChildren(
    ...renderChecklist(plan, checked, (id, isChecked) => {
      if (isChecked) checked.add(id);
      else checked.delete(id);
      saveChecked(key, checked);
      updateProgress();
    }),
  );
  updateProgress();

  byId('results-sub').textContent =
    `${plan.summary.eventLabel} on ${formatDate(plan.summary.eventDate)} · ${plan.summary.guests.toLocaleString('en-IN')} guests`;
  chat.reset();
  card.reset(ideas);
  workspace.reset();
  showView('results');
  byId('results-heading').focus({ preventScroll: false });
}

async function createPlan(payload) {
  clearErrors();
  setBusy(true);
  try {
    const response = await postJson('/api/plan', payload);
    currentEvent = payload;
    showPlan(response);
  } catch (error) {
    showErrors(error instanceof ApiError ? error : new ApiError('Something went wrong. Please try again.'));
  } finally {
    setBusy(false);
  }
}

/* ---------- header and results actions ---------- */
function backToForm() {
  showView('plan');
  wizard.go(1);
  byId('wizard-title').focus();
}
restartButton.addEventListener('click', () => {
  wizard.reset();
  backToForm();
});
byId('edit-btn').addEventListener('click', backToForm); // the form still holds the last answers
byId('print-btn').addEventListener('click', () => window.print());

// Buttons on the finish screen reuse the existing actions.
byId('finish-print').addEventListener('click', () => window.print());
byId('finish-explore').addEventListener('click', () => byId('nav-explore').click());
byId('finish-new').addEventListener('click', () => restartButton.click());

byId('nav-plan').addEventListener('click', () => showView(currentEvent ? 'results' : 'plan'));
byId('nav-explore').addEventListener('click', async () => {
  showView('explore');
  byId('explore-heading').focus();
  await explore.open();
});

form.addEventListener('input', clearErrors);

getHealth().then((health) => {
  aiEnabled = Boolean(health?.ai);
  imageEnabled = Boolean(health?.image);
  if (health?.today) {
    // Use the server's date for every date limit, so the pickers match what the server accepts.
    setServerToday(health.today);
    wizard.refreshDates();
    explore.refreshDates();
  }
});
