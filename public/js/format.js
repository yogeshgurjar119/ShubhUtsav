const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatINR = (amount) => inr.format(amount);

/** "2027-06-20" -> "20 June 2027" (parsed as a plain date, so no timezone shifts). */
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function daysLabel(days) {
  if (days === 0) return 'Today';
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
let serverToday = null;

/** Remembers the server's date. It counts in the server's timezone, which can differ from the browser's. */
export function setServerToday(iso) {
  if (ISO_DATE.test(iso ?? '')) serverToday = iso;
}

function browserToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Adds calendar months to YYYY-MM-DD, keeping the day (or the month's last day when it is shorter). */
export function addMonths(iso, months) {
  const [year, month, day] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Today plus some months as YYYY-MM-DD, using the server's date once it is known. */
export const todayPlus = (months = 0) => addMonths(serverToday ?? browserToday(), months);

/** 800000 -> "₹8 lakh", 25000000 -> "₹2.5 crore" (how Indians usually say amounts). */
export function formatIndianWords(amount) {
  const trim = (n) => String(Math.round(n * 100) / 100);
  if (amount >= 1e7) return `₹${trim(amount / 1e7)} crore`;
  if (amount >= 1e5) return `₹${trim(amount / 1e5)} lakh`;
  if (amount >= 1e3) return `₹${trim(amount / 1e3)} thousand`;
  return `₹${amount}`;
}
