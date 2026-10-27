import { byId } from './dom.js';
import { todayPlus } from './format.js';
import { readForm, setupNotesCounter, setupPriorityLimit, setupTypeRules } from './wizardRules.js';

const LAST_STEP = 3;
const DEFAULT_MONTHS_AHEAD = 6;

/** The step-by-step part of the form: which step is shown, validation, and the Back/Next buttons. */
function createSteps(form) {
  const sections = [...form.querySelectorAll('.form-step')];
  const stepper = byId('form-stepper');
  const buttons = { back: byId('back-btn'), next: byId('next-btn'), submit: byId('submit-btn') };
  let current = 1;

  function show(step, { focus = false } = {}) {
    current = step;
    for (const section of sections) section.hidden = Number(section.dataset.step) !== step;
    for (const item of stepper.children) {
      const n = Number(item.dataset.step);
      item.classList.toggle('current', n === step);
      item.classList.toggle('done', n < step);
      if (n === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    }
    buttons.back.hidden = step === 1;
    buttons.next.hidden = step === LAST_STEP;
    buttons.submit.hidden = step !== LAST_STEP;
    if (focus) sections[step - 1].querySelector('.step-title')?.focus();
  }

  /** True when every field in the step is valid; otherwise shows the browser's message on the first bad one. */
  function validate(step) {
    for (const field of sections[step - 1].querySelectorAll('input, select, textarea')) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  /** Index of the first step with an invalid field (shown to the person), or 0 when all are fine. */
  function firstInvalidStep() {
    for (let step = 1; step <= LAST_STEP; step += 1) {
      if (!validate(step)) return step;
    }
    return 0;
  }

  // Stay inside the real steps even if a button fires from the wrong place (e.g. "next" on the last step).
  const go = (step) => show(Math.max(1, Math.min(LAST_STEP, step)), { focus: true });

  function next() {
    if (validate(current)) go(current + 1);
  }
  buttons.next.addEventListener('click', next);
  buttons.back.addEventListener('click', () => go(current - 1));

  return { show, go, validate, firstInvalidStep, next, isLast: () => current >= LAST_STEP };
}

/**
 * The three-step setup form. Each step is validated before moving on; Enter moves forward
 * until the last step. `onSubmit(payload)` receives the exact shape the API expects.
 */
export function setupWizard({ form, onSubmit }) {
  const steps = createSteps(form);
  const typeRules = setupTypeRules(form);
  const limitPriorities = setupPriorityLimit(form);
  const updateNotesCount = setupNotesCounter();
  const dateInput = byId('eventDate');

  /** Sets the earliest date and a sensible default (using the server's date once it is known). */
  function refreshDates() {
    dateInput.min = todayPlus(0);
    if (!dateInput.value || dateInput.value < dateInput.min) dateInput.value = todayPlus(DEFAULT_MONTHS_AHEAD);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!steps.isLast()) {
      steps.next();
      return;
    }
    const bad = steps.firstInvalidStep();
    if (bad === 0) {
      onSubmit(readForm(form));
      return;
    }
    steps.show(bad); // the browser can only show its message on a visible field
    steps.validate(bad);
  });

  /** Clears everything back to the starting values (the "New plan" button). */
  function reset() {
    form.reset();
    dateInput.value = todayPlus(DEFAULT_MONTHS_AHEAD);
    typeRules.reset();
    limitPriorities();
    updateNotesCount();
    steps.show(1);
  }

  refreshDates();
  typeRules.apply();
  updateNotesCount();
  steps.show(1);

  return {
    go: steps.go,
    reset,
    refreshDates,
    /** Sets the event date (used by "Plan an event on this date" in Explore). */
    setDate: (iso) => {
      dateInput.value = iso;
    },
  };
}
