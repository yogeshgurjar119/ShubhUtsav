// Remembers which checklist items are ticked, in this browser only.
// localStorage can be unavailable (private mode, blocked), so every access is guarded.

const KEY = 'shubhutsav:checklist:v1';

const readAll = () => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

export const planKey = ({ eventType, eventDate }) => `${eventType}:${eventDate}`;

export function loadChecked(key) {
  const ids = readAll()[key];
  return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
}

export function saveChecked(key, checked) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [key]: [...checked] }));
  } catch {
    /* storage unavailable: ticks just will not persist */
  }
}
