import { CATEGORIES } from './catalog.js';
import { addDays, diffDays } from './dates.js';

/**
 * Vendor and task checklist items.
 * `lead` is how many days before the event the item should be booked or done.
 * `venues` / `diets` (optional) restrict an item to those venue types / diets.
 * `types` limits the item to certain event types; omitted means all of them.
 */
const ITEMS = [
  {
    id: 'venue-book',
    category: 'venue',
    task: 'Book the venue and confirm what is included (power backup, parking, rooms)',
    priority: 'must',
    lead: { wedding: 240, birthday: 35, community: 60, public: 90 },
    venues: ['hall'],
  },
  {
    id: 'venue-outdoor',
    category: 'venue',
    task: 'Book the ground or lawn and arrange a waterproof tent or indoor backup',
    priority: 'must',
    lead: { wedding: 200, birthday: 35, community: 60, public: 90 },
    venues: ['outdoor'],
  },
  {
    id: 'venue-permit',
    category: 'venue',
    task: 'Get local permissions (noise, generator, parking) and share them with the venue',
    priority: 'should',
    lead: { wedding: 45, birthday: 14, community: 45, public: 60 },
    venues: ['outdoor'],
  },
  {
    id: 'venue-home',
    category: 'venue',
    task: 'Plan space, seating, power load and inform neighbours or the society',
    priority: 'must',
    lead: { wedding: 45, birthday: 14, community: 30 },
    venues: ['home'],
  },
  {
    id: 'catering-book',
    category: 'catering',
    task: 'Book the caterer with a written menu, per-plate rate and staff count',
    priority: 'must',
    lead: { wedding: 150, birthday: 21, community: 30, public: 30 },
  },
  {
    id: 'catering-tasting',
    category: 'catering',
    task: 'Attend a menu tasting and freeze the final menu',
    priority: 'should',
    lead: { wedding: 45, birthday: 10, community: 14, public: 14 },
  },
  {
    id: 'catering-veg',
    category: 'catering',
    task: 'Confirm a fully vegetarian kitchen and serving counters',
    priority: 'must',
    lead: { wedding: 45, birthday: 14, community: 14, public: 14 },
    diets: ['veg', 'jain'],
  },
  {
    id: 'catering-jain',
    category: 'catering',
    task: 'Confirm a Jain menu (no onion, garlic or root vegetables) with the caterer',
    priority: 'must',
    lead: { wedding: 45, birthday: 14, community: 14, public: 14 },
    diets: ['jain'],
  },
  {
    id: 'decor-book',
    category: 'decor',
    task: 'Finalise the decor theme, stage and lighting with the decorator',
    priority: 'must',
    lead: { wedding: 150, birthday: 21, community: 30, public: 30 },
  },
  {
    id: 'decor-flowers',
    category: 'decor',
    task: 'Order flowers, garlands and ritual items',
    priority: 'should',
    lead: { wedding: 7, birthday: 3, community: 5, public: 5 },
  },
  {
    id: 'photo-book',
    category: 'photography',
    task: 'Book photographer or videographer and agree deliverables and timelines',
    priority: 'must',
    lead: { wedding: 150, birthday: 21, community: 21, public: 21 },
  },
  {
    id: 'photo-shots',
    category: 'photography',
    task: 'Share a must-have shot list (family groups, key moments)',
    priority: 'nice',
    lead: { wedding: 14, birthday: 7, community: 7, public: 7 },
  },
  {
    id: 'attire-buy',
    category: 'attire',
    task: 'Buy or rent outfits, jewellery and accessories',
    priority: 'must',
    lead: { wedding: 120, birthday: 14 },
    types: ['wedding', 'birthday'],
  },
  {
    id: 'attire-fit',
    category: 'attire',
    task: 'Complete final fittings and alterations',
    priority: 'should',
    lead: { wedding: 21 },
    types: ['wedding'],
  },
  {
    id: 'ent-book',
    category: 'entertainment',
    task: 'Book the DJ, band, emcee or entertainer and share your song list',
    priority: 'should',
    lead: { wedding: 120, birthday: 21, community: 30, public: 60 },
  },
  {
    id: 'ent-rehearse',
    category: 'entertainment',
    task: 'Rehearse performances and test the sound system',
    priority: 'nice',
    lead: { wedding: 30, birthday: 7, community: 7, public: 7 },
  },
  {
    id: 'inv-send',
    category: 'invitations',
    task: 'Design and send invitations (print and digital)',
    priority: 'must',
    lead: { wedding: 90, birthday: 14, community: 21, public: 30 },
  },
  {
    id: 'inv-rsvp',
    category: 'invitations',
    task: 'Track RSVPs and update the headcount for the caterer',
    priority: 'should',
    lead: { wedding: 21, birthday: 5, community: 7, public: 7 },
  },
  {
    id: 'gifts-order',
    category: 'gifts',
    task: 'Order return gifts or favours',
    priority: 'nice',
    lead: { wedding: 30, birthday: 10, community: 14 },
  },
  {
    id: 'logi-stay',
    category: 'logistics',
    task: 'Arrange stay and local transport for outstation guests',
    priority: 'should',
    lead: { wedding: 60 },
    types: ['wedding'],
  },
  {
    id: 'logi-volunteers',
    category: 'logistics',
    task: 'Recruit volunteers and assign roles, including first aid and crowd control',
    priority: 'must',
    lead: { community: 30, public: 30 },
    types: ['community', 'public'],
  },
  {
    id: 'logi-sheet',
    category: 'logistics',
    task: 'Prepare a vendor contact sheet and a day-of timeline',
    priority: 'must',
    lead: { wedding: 7, birthday: 3, community: 7, public: 7 },
  },
  {
    id: 'logi-kit',
    category: 'logistics',
    task: 'Pack an emergency kit (first aid, safety pins, snacks, chargers)',
    priority: 'should',
    lead: { wedding: 3, birthday: 2, community: 3, public: 3 },
  },
  {
    id: 'pub-permits',
    category: 'logistics',
    task: 'Get permissions: police, fire safety, noise, municipal and electricity',
    priority: 'must',
    lead: { public: 60 },
    types: ['public'],
  },
  {
    id: 'pub-insurance',
    category: 'logistics',
    task: 'Buy event and public-liability insurance',
    priority: 'should',
    lead: { public: 45 },
    types: ['public'],
  },
  {
    id: 'pub-security',
    category: 'logistics',
    task: 'Hire licensed security and plan entry, exit and barricades',
    priority: 'must',
    lead: { public: 30 },
    types: ['public'],
  },
  {
    id: 'pub-crowd',
    category: 'logistics',
    task: 'Plan crowd flow, parking, toilets, drinking water and waste',
    priority: 'must',
    lead: { public: 21 },
    types: ['public'],
  },
  {
    id: 'pub-medical',
    category: 'logistics',
    task: 'Set up a first-aid post and keep an ambulance on standby',
    priority: 'must',
    lead: { public: 21 },
    types: ['public'],
  },
  {
    id: 'pub-power',
    category: 'logistics',
    task: 'Arrange generator and power backup, and test the sound system',
    priority: 'should',
    lead: { public: 14 },
    types: ['public'],
  },
  {
    id: 'pub-ticketing',
    category: 'invitations',
    task: 'Set up ticketing or registration with a capacity limit',
    priority: 'must',
    lead: { public: 45 },
    types: ['public'],
  },
  {
    id: 'pub-sponsors',
    category: 'invitations',
    task: 'Pitch sponsors and agree what each one gets',
    priority: 'should',
    lead: { public: 75 },
    types: ['public'],
  },
];

/**
 * Builds the checklist for one plan, grouped by budget category.
 * An item is `urgent` when the ideal booking date has already passed.
 */
export function buildChecklist({ eventType, eventDate, today, venueType, dietary, allocations }) {
  const groups = new Map();

  for (const item of ITEMS) {
    if (item.types && !item.types.includes(eventType)) continue;
    if (item.venues && !item.venues.includes(venueType)) continue;
    if (item.diets && !item.diets.includes(dietary)) continue;
    const lead = item.lead[eventType];
    if (lead === undefined) continue;

    const idealDate = addDays(eventDate, -lead);
    const urgent = diffDays(today, idealDate) < 0;
    const entry = {
      id: item.id,
      task: item.task,
      priority: item.priority,
      bookBy: urgent ? today : idealDate,
      urgent,
    };
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(entry);
  }

  const amountOf = Object.fromEntries(allocations.map((a) => [a.category, a.amount]));
  return [...groups.entries()].map(([category, items]) => ({
    category,
    label: CATEGORIES[category],
    allocation: amountOf[category] ?? 0,
    items: items.sort((a, b) => a.bookBy.localeCompare(b.bookBy)),
  }));
}
