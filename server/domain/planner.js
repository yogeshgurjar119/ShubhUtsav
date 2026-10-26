import { EVENTS } from './catalog.js';
import { allocateBudget } from './budget.js';
import { buildChecklist } from './checklist.js';
import { diffDays } from './dates.js';
import { assessFeasibility } from './feasibility.js';
import { buildTimeline } from './timeline.js';

/**
 * Builds the complete deterministic plan from validated input.
 * Pure function: same input and `today` always give the same plan, with no I/O.
 */
export function createPlan(input, today) {
  const daysLeft = diffDays(today, input.eventDate);

  const budget = allocateBudget({
    eventType: input.eventType,
    budget: input.budget,
    priorities: input.priorities,
    venueType: input.venueType,
    daysLeft,
  });
  const feasibility = assessFeasibility({ ...input, daysLeft });
  const timeline = buildTimeline({ eventType: input.eventType, eventDate: input.eventDate, today });
  const checklist = buildChecklist({ ...input, today, allocations: budget.allocations });

  return {
    summary: {
      eventType: input.eventType,
      eventLabel: EVENTS[input.eventType].label,
      eventDate: input.eventDate,
      daysLeft,
      guests: input.guests,
      budget: input.budget,
    },
    budget,
    feasibility,
    timeline,
    checklist,
  };
}
