import { byId } from './dom.js';
import { formatINR, formatIndianWords, localToday } from './format.js';

const LAST_STEP = 3;
const MAX_PRIORITIES = 3;
const MAX_PRIVATE_GUESTS = 5000;
const MAX_PUBLIC_GUESTS = 50_000;

// Sensible starting numbers per event type (only applied until the user edits the field).
const PRESETS = {
  wedding: { guests: 200, budget: 1_200_000 },
  birthday: { guests: 40, budget: 60_000 },
  community: { guests: 300, budget: 150_000 },
  public: { guests: 5000, budget: 2_500_000 },
};

/**
 * The three-step setup form. Each step is validated before moving on; Enter moves forward
 * until the last step. `onSubmit(payload)` receives the exact shape the API expects.
 */
export function setupWizard({ form, onSubmit }) {
  const steps = [...form.querySelectorAll('.form-step')];
  const stepper = byId('form-stepper');
  const backButton = byId('back-btn');
  const nextButton = byId('next-btn');
  const submitButton = byId('submit-btn');
  const guests = byId('guests');
  const budget = byId('budget');
  const venue = byId('venueType');
  const touched = new Set();
  let current = 1;

  /* ---------- reading the form ---------- */
  function read() {
    const data = new FormData(form);
    return {
      eventType: data.get('eventType'),
      guests: Number(data.get('guests')),
      budget: Number(data.get('budget')),
      eventDate: data.get('eventDate'),
      cityTier: data.get('cityTier'),
      venueType: data.get('venueType'),
      dietary: data.get('dietary'),
      priorities: data.getAll('priorities'),
      notes: String(data.get('notes') ?? ''),
    };
  }

  /* ---------- steps ---------- */
  function show(step, { focus = false } = {}) {
    current = step;
    for (const section of steps) section.hidden = Number(section.dataset.step) !== step;
    for (const item of stepper.children) {
      const n = Number(item.dataset.step);
      item.classList.toggle('current', n === step);
      item.classList.toggle('done', n < step);
      if (n === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    }
    backButton.hidden = step === 1;
    nextButton.hidden = step === LAST_STEP;
    submitButton.hidden = step !== LAST_STEP;
    if (focus) steps[step - 1].querySelector('.step-title')?.focus();
  }

  function validateStep(step) {
    const section = steps[step - 1];
    for (const field of section.querySelectorAll('input, select, textarea')) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function go(step) {
    show(step, { focus: true });
  }

  nextButton.addEventListener('click', () => {
    if (validateStep(current)) go(current + 1);
  });
  backButton.addEventListener('click', () => go(current - 1));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (current < LAST_STEP) {
      if (validateStep(current)) go(current + 1);
      return;
    }
    for (let step = 1; step <= LAST_STEP; step += 1) {
      if (!validateStep(step)) {
        show(step);
        validateStep(step);
        return;
      }
    }
    onSubmit(read());
  });

  /* ---------- event-type rules ---------- */
  function applyTypeRules() {
    const type = form.elements.eventType.value;
    const isPublic = type === 'public';

    guests.max = String(isPublic ? MAX_PUBLIC_GUESTS : MAX_PRIVATE_GUESTS);
    byId('guests-label').textContent = isPublic ? 'Expected attendance' : 'Number of guests';
    byId('guests-hint').textContent = isPublic ? 'Up to 50,000 people.' : 'Up to 5,000 guests.';

    // A public event cannot be held at home.
    const home = venue.querySelector('option[value="home"]');
    home.disabled = isPublic;
    if (isPublic && venue.value === 'home') venue.value = 'hall';

    const preset = PRESETS[type];
    if (!touched.has('guests')) guests.value = preset.guests;
    if (!touched.has('budget')) budget.value = preset.budget;
    updateBudgetHint();
  }

  function updateBudgetHint() {
    const amount = Number(budget.value);
    const people = Number(guests.value);
    const hint = byId('budget-hint');
    if (!Number.isFinite(amount) || amount <= 0) {
      hint.textContent = '';
      return;
    }
    const perGuest = people > 0 ? ` · about ${formatINR(amount / people)} per guest` : '';
    hint.textContent = `${formatIndianWords(amount)}${perGuest}`;
  }

  for (const radio of form.querySelectorAll('input[name="eventType"]')) radio.addEventListener('change', applyTypeRules);
  guests.addEventListener('input', () => {
    touched.add('guests');
    updateBudgetHint();
  });
  budget.addEventListener('input', () => {
    touched.add('budget');
    updateBudgetHint();
  });

  /* ---------- priorities and notes ---------- */
  function limitPriorities() {
    const boxes = [...form.querySelectorAll('input[name="priorities"]')];
    const selected = boxes.filter((b) => b.checked).length;
    for (const box of boxes) box.disabled = !box.checked && selected >= MAX_PRIORITIES;
  }
  byId('priorities').addEventListener('change', limitPriorities);

  const notes = byId('notes');
  const updateNotesCount = () => {
    byId('notes-count').textContent = `${notes.value.length} / ${notes.maxLength}`;
  };
  notes.addEventListener('input', updateNotesCount);

  /* ---------- start-up ---------- */
  const dateInput = byId('eventDate');
  dateInput.min = localToday();
  dateInput.value = localToday(6);
  applyTypeRules();
  updateNotesCount();
  show(1);

  /** Clears everything back to the starting values (the "New plan" button). */
  function reset() {
    form.reset();
    touched.clear();
    dateInput.value = localToday(6);
    applyTypeRules();
    limitPriorities();
    updateNotesCount();
    show(1);
  }

  /** Sets the event date (used by "Plan an event on this date" in Explore). */
  function setDate(iso) {
    dateInput.value = iso;
  }

  return { go: (step) => show(step, { focus: true }), reset, setDate };
}
