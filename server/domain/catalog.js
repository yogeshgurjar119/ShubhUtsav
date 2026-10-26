// Static planning knowledge. Keeping it as data (not logic) makes it easy to review and tune.

export const EVENT_TYPES = Object.freeze(['wedding', 'birthday', 'community', 'public']);
export const CITY_TIERS = Object.freeze(['metro', 'tier2', 'tier3']);
export const VENUE_TYPES = Object.freeze(['hall', 'outdoor', 'home']);
export const DIETS = Object.freeze(['veg', 'mixed', 'jain']);

export const CATEGORIES = Object.freeze({
  venue: 'Venue',
  catering: 'Food & catering',
  decor: 'Decor & lighting',
  photography: 'Photo & video',
  attire: 'Attire & styling',
  entertainment: 'Music & entertainment',
  invitations: 'Invitations & promotion',
  gifts: 'Gifts & favours',
  logistics: 'Logistics & misc.',
});

/** Categories a host may mark as "most important to me". */
export const PRIORITY_CATEGORIES = Object.freeze([
  'venue',
  'catering',
  'decor',
  'photography',
  'entertainment',
  'attire',
]);

export const EVENTS = Object.freeze({
  wedding: {
    label: 'Wedding',
    // Share of the spendable budget (before the contingency reserve). Need not sum to 100.
    weights: { venue: 22, catering: 30, decor: 12, photography: 10, attire: 12, entertainment: 6, invitations: 2, gifts: 3, logistics: 3 },
    // Minimum and comfortable total spend per guest in INR, by city tier.
    perGuest: {
      lean: { metro: 2500, tier2: 1800, tier3: 1300 },
      comfortable: { metro: 5000, tier2: 3500, tier3: 2500 },
    },
  },
  birthday: {
    label: 'Birthday',
    weights: { venue: 15, catering: 35, decor: 18, photography: 6, attire: 3, entertainment: 15, invitations: 2, gifts: 4, logistics: 2 },
    perGuest: {
      lean: { metro: 1000, tier2: 700, tier3: 500 },
      comfortable: { metro: 2200, tier2: 1600, tier3: 1100 },
    },
  },
  public: {
    label: 'Public event',
    // Fairs, festivals, concerts, exhibitions and conferences open to the public.
    weights: { venue: 20, catering: 12, decor: 10, photography: 5, entertainment: 25, invitations: 8, logistics: 20 },
    perGuest: {
      lean: { metro: 300, tier2: 200, tier3: 150 },
      comfortable: { metro: 800, tier2: 550, tier3: 400 },
    },
  },
  community: {
    label: 'Community event',
    weights: { venue: 20, catering: 35, decor: 10, photography: 4, entertainment: 15, invitations: 3, gifts: 3, logistics: 10 },
    perGuest: {
      lean: { metro: 400, tier2: 300, tier3: 200 },
      comfortable: { metro: 900, tier2: 650, tier3: 450 },
    },
  },
});

/** Percentage points added to a category the host marked as a priority. */
export const PRIORITY_BOOST = 6;
/** Reserve for surprises, as a percentage of the total budget. */
export const CONTINGENCY_PCT = Object.freeze({ normal: 7, rushed: 10 });
/** Fewer than this many days to go counts as a rushed plan. */
export const RUSHED_DAYS = 30;
