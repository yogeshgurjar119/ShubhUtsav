import { addDays, diffDays } from './dates.js';

/**
 * Milestones per event type: [days before the event, title, tasks].
 * Listed from earliest to the event day.
 */
const TEMPLATES = Object.freeze({
  wedding: [
    [270, 'Lay the foundation', ['Fix the overall budget and who decides what', 'Draft the guest list with both families', 'Shortlist auspicious dates with the priest']],
    [210, 'Lock the date and venue', ['Visit and book the venue', 'Decide whether to hire a wedding planner', 'Inform key relatives of the date']],
    [150, 'Book the big vendors', ['Book caterer, photographer and decorator', 'Book DJ, band or sangeet choreographer', 'Start outfit and jewellery shopping']],
    [90, 'Invitations and travel', ['Finalise and print invitations, send digital ones too', 'Send invitations to guests', 'Arrange stay and travel for outstation guests']],
    [45, 'Tastings and details', ['Menu tasting and final menu', 'Finalise decor design and layout', 'Book makeup, mehendi and transport']],
    [21, 'Confirm and count', ['Track RSVPs and update the headcount', 'Draft seating and the ritual schedule', 'Agree a payment schedule with each vendor']],
    [7, 'Final confirmations', ['Reconfirm every vendor in writing with timings', 'Pack ritual items and an emergency kit', 'Assign day-of duties to trusted family helpers']],
    [1, 'The day before', ['Walk through the venue and check the setup', 'Prepare envelopes for vendor balances and tips', 'Rest early and charge all devices']],
    [0, 'Event day', ['Follow the run-of-show checklist', 'Keep one person as the vendor point of contact', 'Enjoy the celebration']],
  ],
  birthday: [
    [60, 'Set the plan', ['Fix budget, guest list and theme', 'Pick a date and a backup date']],
    [30, 'Book the essentials', ['Book venue or confirm the home setup', 'Book caterer or order the cake', 'Book entertainer, photographer or games host']],
    [14, 'Invite and arrange', ['Send invitations and track RSVPs', 'Order decor, balloons and return gifts']],
    [7, 'Confirm everything', ['Reconfirm vendors and delivery times', 'Plan the party schedule and games']],
    [3, 'Final prep', ['Confirm the headcount with the caterer', 'Prepare the playlist and the cake-cutting moment']],
    [1, 'The day before', ['Set up decor where possible', 'Charge cameras and pack supplies']],
    [0, 'Party day', ['Start setup early', 'Assign one helper to greet guests', 'Enjoy the celebration']],
  ],
  public: [
    [120, 'Define the event', ['Agree purpose, audience size, budget and the organising team', 'Fix the date and shortlist venues or grounds']],
    [90, 'Venue and permissions', ['Book the venue or ground', 'Apply for police, fire, noise, municipal and electricity permissions', 'Buy event and public-liability insurance']],
    [60, 'Partners and vendors', ['Pitch and sign sponsors', 'Book stage, sound, lighting, security and food stalls', 'Book performers or speakers']],
    [30, 'Promote and sell', ['Open ticketing or registration with a capacity limit', 'Launch promotion: posters, social media, local media', 'Recruit and train volunteers']],
    [14, 'Safety and flow', ['Finalise the crowd, entry, exit and parking plan', 'Arrange first-aid post, ambulance, drinking water and toilets', 'Run a briefing with security and volunteers']],
    [7, 'Confirm everything', ['Reconfirm every vendor, permit and performer in writing', 'Test power backup and the sound system', 'Share the run-of-show and emergency contacts']],
    [1, 'Setup day', ['Set up stage, signage, barricades and stalls', 'Do a full safety walkthrough', 'Brief the team one last time']],
    [0, 'Event day', ['Open gates on schedule and monitor crowd levels', 'Keep a control desk for lost-and-found and emergencies', 'Collect feedback and settle vendors']],
  ],
  community: [
    [90, 'Define the event', ['Agree purpose, budget and organising committee', 'Fix date, expected turnout and venue options']],
    [45, 'Secure venue and permissions', ['Book the venue or ground', 'Apply for permissions (society, police, sound, fire safety)', 'Open a sponsorship or contribution plan']],
    [30, 'Book vendors and volunteers', ['Book caterer, sound and lighting', 'Recruit and brief volunteers', 'Plan the programme and speakers']],
    [14, 'Announce and prepare', ['Publicise via posters, WhatsApp groups and social media', 'Arrange seating, first aid and drinking water']],
    [7, 'Confirm logistics', ['Reconfirm vendors and the volunteer roster', 'Plan crowd flow, parking and waste handling']],
    [1, 'The day before', ['Set up the stage and signage', 'Brief volunteers and test the sound system']],
    [0, 'Event day', ['Follow the programme schedule', 'Keep a committee lead at every key point', 'Collect feedback']],
  ],
});

/**
 * Turns a template into dated milestones counting back from the event date.
 * If there is less lead time than the template assumes, every offset is scaled down
 * proportionally and `compressed` is true. Milestones that land on the same day merge.
 */
export function buildTimeline({ eventType, eventDate, today }) {
  const daysLeft = Math.max(0, diffDays(today, eventDate));
  const template = TEMPLATES[eventType];
  const longestLead = template[0][0];
  const compressed = daysLeft < longestLead;
  const scale = compressed ? daysLeft / longestLead : 1;

  const milestones = [];
  for (const [offset, title, tasks] of template) {
    const daysBefore = Math.round(offset * scale);
    const previous = milestones.at(-1);
    if (previous && previous.daysBefore === daysBefore) {
      previous.title = title;
      previous.tasks.push(...tasks);
    } else {
      milestones.push({ daysBefore, title, tasks: [...tasks] });
    }
  }

  return {
    compressed,
    milestones: milestones.map((m) => ({ ...m, date: addDays(eventDate, -m.daysBefore) })),
  };
}
