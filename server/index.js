import { buildApp } from './bootstrap.js';

// Load .env when present (Node 20.12+). Real environment variables always win.
try {
  process.loadEnvFile();
} catch {
  /* no .env file: use the real environment */
}

const { app, config, llm, calendarific, ticketmaster } = buildApp();

const server = app.listen(config.port, () => {
  console.log(`ShubhUtsav running on http://localhost:${config.port}`);
  if (!llm.available) console.warn('NVIDIA_API_KEY is not set: using the built-in idea bank and no chat.');
  if (!calendarific.available) console.warn('CALENDARIFIC_API_KEY is not set: the festivals list in Explore is off.');
  if (!ticketmaster.available) console.warn('TICKETMASTER_API_KEY is not set: live event search in Explore is off.');
});

// Stop cleanly on SIGINT/SIGTERM (Ctrl+C, Docker, Render).
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
