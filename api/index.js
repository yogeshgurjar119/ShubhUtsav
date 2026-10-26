// Vercel entry point: every /api/* request is rewritten here (see vercel.json) and handled by the
// same Express app that `npm start` runs. Static files in public/ are served by Vercel directly.
import { buildApp } from '../server/bootstrap.js';

const { app } = buildApp();

export default app;
