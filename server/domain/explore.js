import { z } from 'zod';
import { addDays, diffDays, isValidIsoDate } from './dates.js';

/** Countries offered in the Explore panel (ISO 3166-1 alpha-2). */
export const COUNTRIES = Object.freeze({
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  NZ: 'New Zealand',
  IE: 'Ireland',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  NL: 'Netherlands',
  AE: 'United Arab Emirates',
  SG: 'Singapore',
  MX: 'Mexico',
  ZA: 'South Africa',
  JP: 'Japan',
});

/** Our category names -> Ticketmaster `classificationName`. */
export const EVENT_CATEGORIES = Object.freeze({
  music: 'Music',
  sports: 'Sports',
  arts: 'Arts & Theatre',
  film: 'Film',
  family: 'Family',
});

const MAX_EVENT_RANGE_DAYS = 120;
const MAX_YEARS_AHEAD = 3;
const PLACE = /^[\p{L}\p{M}\p{N} .'&-]+$/u;
const place = (label) => z.string().trim().min(1).max(60).regex(PLACE, `${label} can only contain letters, numbers and spaces`);
const country = z.enum(Object.keys(COUNTRIES));

/** Query for the festivals and holidays list (all values arrive as strings). */
export function makeFestivalQuerySchema(today) {
  const thisYear = Number(today.slice(0, 4));
  return z.strictObject({
    country: country.default('IN'),
    year: z.coerce.number().int().min(thisYear).max(thisYear + MAX_YEARS_AHEAD).default(thisYear),
    month: z.coerce.number().int().min(1).max(12).optional(),
  });
}

/** Query for live event search. The date range is capped so one request cannot ask for years of data. */
export function makeEventsQuerySchema(today) {
  return z
    .strictObject({
      country,
      city: place('City').optional(),
      keyword: place('Keyword').optional(),
      category: z.enum(Object.keys(EVENT_CATEGORIES)).optional(),
      from: z.string().refine(isValidIsoDate, 'Use a real date in YYYY-MM-DD format').default(today),
      to: z.string().refine(isValidIsoDate, 'Use a real date in YYYY-MM-DD format').optional(),
    })
    .transform((q) => ({ ...q, to: q.to ?? addDays(q.from, 30) }))
    .superRefine((q, ctx) => {
      if (!isValidIsoDate(q.from) || !isValidIsoDate(q.to)) return;
      if (diffDays(today, q.from) < 0) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Start date cannot be in the past' });
      if (diffDays(q.from, q.to) < 0) ctx.addIssue({ code: 'custom', path: ['to'], message: 'End date must be on or after the start date' });
      else if (diffDays(q.from, q.to) > MAX_EVENT_RANGE_DAYS) {
        ctx.addIssue({ code: 'custom', path: ['to'], message: `Search at most ${MAX_EVENT_RANGE_DAYS} days at a time` });
      }
    });
}

/* ---------- Normalising third-party data. Everything is untrusted: type-checked and length-capped. ---------- */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const str = (value, max) => (typeof value === 'string' ? value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Calendarific response -> `[{ date, name, description, types }]` sorted by date. */
export function normalizeHolidays(payload) {
  const list = payload?.response?.holidays;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const date = str(item?.date?.iso, 25).slice(0, 10);
    const name = str(item?.name, 100);
    if (!name || !isValidIsoDate(date)) continue;
    const types = (Array.isArray(item.type) ? item.type : [item.primary_type]).map((t) => str(t, 40)).filter(Boolean).slice(0, 3);
    out.push({ date, name, description: str(item.description, 220), types });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

// Only Ticketmaster's own image hosts are accepted (the page's CSP allows exactly these).
const IMAGE_HOST = /(^|\.)ticketm\.net$/i;
const safeHttpsUrl = (value, hostTest) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!hostTest || hostTest.test(url.hostname)) ? url.toString() : '';
  } catch {
    return '';
  }
};

/** Ticketmaster Discovery response -> compact event cards. */
export function normalizeEvents(payload) {
  const list = payload?._embedded?.events;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const date = str(item?.dates?.start?.localDate, 10);
    const name = str(item?.name, 120);
    if (!name || !isValidIsoDate(date)) continue;

    const venue = item?._embedded?.venues?.[0];
    const classification = item?.classifications?.[0];
    const price = item?.priceRanges?.[0];
    const images = Array.isArray(item?.images) ? item.images : [];
    const image = images
      .filter((img) => safeHttpsUrl(img?.url, IMAGE_HOST))
      .sort((a, b) => Math.abs((a.width ?? 0) - 400) - Math.abs((b.width ?? 0) - 400))[0];

    out.push({
      id: str(item.id, 40),
      name,
      date,
      time: str(item?.dates?.start?.localTime, 8).slice(0, 5),
      status: str(item?.dates?.status?.code, 20),
      category: str(classification?.segment?.name, 40),
      genre: str(classification?.genre?.name, 40),
      venue: str(venue?.name, 100),
      city: str(venue?.city?.name, 60),
      country: str(venue?.country?.countryCode, 2),
      priceMin: Number.isFinite(price?.min) ? price.min : null,
      priceMax: Number.isFinite(price?.max) ? price.max : null,
      currency: str(price?.currency, 3),
      url: safeHttpsUrl(item.url),
      image: image ? safeHttpsUrl(image.url, IMAGE_HOST) : '',
    });
  }
  return out;
}
