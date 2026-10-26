import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createCalendarService } from './services/calendar.js';
import { createCalendarificService } from './services/calendarific.js';
import { createNvidiaClient } from './services/nvidia.js';
import { createNvidiaImageClient } from './services/nvidiaImage.js';
import { createTicketmasterService } from './services/ticketmaster.js';

/**
 * Wires the real services together from environment variables. Shared by the Node server
 * (server/index.js) and the Vercel function (api/index.js), so both behave identically.
 */
export function buildApp(env = process.env, logger = console) {
  const config = loadConfig(env);
  const llm = createNvidiaClient({ ...config.nvidia, logger });
  const imageClient = createNvidiaImageClient({ ...config.image, logger });
  const calendar = createCalendarService({ url: config.holidayFeedUrl });
  const calendarific = createCalendarificService(config.calendarific);
  const ticketmaster = createTicketmasterService(config.ticketmaster);
  const app = createApp({ config, llm, imageClient, calendar, calendarific, ticketmaster, logger });
  return { app, config, llm, imageClient, calendarific, ticketmaster };
}
