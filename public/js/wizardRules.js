import { byId } from './dom.js';
import { formatINR, formatIndianWords } from './format.js';

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

/** Reads the form into the exact shape the API expects. */
export function readForm(form) {
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

function updateBudgetHint(guests, budget) {
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

/**
 * Rules that depend on the event type: guest limits and labels, no "at home" for public events,
 * and starting numbers for guests and budget (kept until the person types their own).
 * Returns `apply()` to re-run the rules and `reset()` to forget what was typed.
 */
export function setupTypeRules(form) {
  const guests = byId('guests');
  const budget = byId('budget');
  const venue = byId('venueType');
  const touched = new Set();

  function apply() {
    const type = form.elements.eventType.value;
    const isPublic = type === 'public';

    guests.max = String(isPublic ? MAX_PUBLIC_GUESTS : MAX_PRIVATE_GUESTS);
    byId('guests-label').textContent = isPublic ? 'Expected attendance' : 'Number of guests';
    byId('guests-hint').textContent = isPublic ? 'Up to 50,000 people.' : 'Up to 5,000 guests.';

    // A public event cannot be held at home.
    venue.querySelector('option[value="home"]').disabled = isPublic;
    if (isPublic && venue.value === 'home') venue.value = 'hall';

    if (!touched.has('guests')) guests.value = PRESETS[type].guests;
    if (!touched.has('budget')) budget.value = PRESETS[type].budget;
    updateBudgetHint(guests, budget);
  }

  for (const radio of form.querySelectorAll('input[name="eventType"]')) radio.addEventListener('change', apply);
  for (const [name, field] of [
    ['guests', guests],
    ['budget', budget],
  ]) {
    field.addEventListener('input', () => {
      touched.add(name);
      updateBudgetHint(guests, budget);
    });
  }

  return {
    apply,
    reset() {
      touched.clear();
      apply();
    },
  };
}

/** Allows at most three priorities by disabling the remaining boxes. Returns the function that re-checks. */
export function setupPriorityLimit(form) {
  function limit() {
    const boxes = [...form.querySelectorAll('input[name="priorities"]')];
    const selected = boxes.filter((box) => box.checked).length;
    for (const box of boxes) box.disabled = !box.checked && selected >= MAX_PRIORITIES;
  }
  byId('priorities').addEventListener('change', limit);
  return limit;
}

/** Live "12 / 500" counter for the notes box. Returns the function that refreshes it. */
export function setupNotesCounter() {
  const notes = byId('notes');
  const update = () => {
    byId('notes-count').textContent = `${notes.value.length} / ${notes.maxLength}`;
  };
  notes.addEventListener('input', update);
  return update;
}
