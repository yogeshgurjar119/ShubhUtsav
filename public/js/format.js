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

/** Local calendar date as YYYY-MM-DD, optionally some months ahead (used for the date input). */
export function localToday(monthsAhead = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 800000 -> "₹8 lakh", 25000000 -> "₹2.5 crore" (how Indians usually say amounts). */
export function formatIndianWords(amount) {
  const trim = (n) => String(Math.round(n * 100) / 100);
  if (amount >= 1e7) return `₹${trim(amount / 1e7)} crore`;
  if (amount >= 1e5) return `₹${trim(amount / 1e5)} lakh`;
  if (amount >= 1e3) return `₹${trim(amount / 1e3)} thousand`;
  return `₹${amount}`;
}
