// Reads and validates environment variables once, at startup.

const DEFAULT_HOLIDAY_FEED =
  'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics';

// Checked against a real key: both answered chat requests and returned valid event ideas.
// The first is small and fast (about 4 s); the second is a slower reasoning model kept as a backup.
// Image models that answered in about 2 s with a real key. (flux.1-schnell hung, so it is not a default.)
const DEFAULT_IMAGE_MODELS = ['black-forest-labs/flux.2-klein-4b', 'black-forest-labs/flux.1-dev'];

const DEFAULT_MODELS = ['nvidia/nemotron-3.5-bolt-e4b', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'];

const parseList = (value, fallback) => {
  const items = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
};

// Accepts the official name first, then common misspellings, so a typo in .env does not silently disable a feature.
const firstSet = (env, names) => names.map((n) => env[n]?.trim()).find(Boolean) || '';

const toInt = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export function loadConfig(env = process.env) {
  return Object.freeze({
    port: toInt(env.PORT, 3000, { min: 1, max: 65535 }),
    timezone: env.APP_TIMEZONE?.trim() || 'Asia/Kolkata',
    // Vercel always sits behind one proxy; elsewhere set TRUST_PROXY yourself.
    trustProxy: toInt(env.TRUST_PROXY, env.VERCEL ? 1 : 0, { min: 0, max: 5 }),
    rateLimit: Object.freeze({
      windowMs: 60_000,
      apiMax: toInt(env.RATE_LIMIT_PER_MIN, 120, { min: 1 }),
      aiMax: toInt(env.RATE_LIMIT_AI_PER_MIN, 20, { min: 1 }),
      imageMax: toInt(env.RATE_LIMIT_IMAGE_PER_MIN, 5, { min: 1 }),
      exploreMax: toInt(env.RATE_LIMIT_EXPLORE_PER_MIN, 30, { min: 1 }),
    }),
    nvidia: Object.freeze({
      apiKey: env.NVIDIA_API_KEY?.trim() || '',
      // Your choices first (comma-separated), then the built-in defaults as a safety net:
      // NVIDIA retires hosted models (HTTP 410), and one stale setting should not switch the AI off.
      models: [...new Set([...parseList(env.NVIDIA_MODEL, []), ...DEFAULT_MODELS])],
      baseUrl: (env.NVIDIA_BASE_URL?.trim() || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, ''),
      timeoutMs: toInt(env.LLM_TIMEOUT_MS, 20000, { min: 1000, max: 120000 }),
    }),
    // Image generation uses the same NVIDIA account by default; a separate key can override it.
    image: Object.freeze({
      apiKey: env.NVIDIA_IMAGE_API_KEY?.trim() || env.NVIDIA_API_KEY?.trim() || '',
      models: [...new Set([...parseList(env.NVIDIA_IMAGE_MODEL, []), ...DEFAULT_IMAGE_MODELS])],
      baseUrl: (env.NVIDIA_IMAGE_BASE_URL?.trim() || 'https://ai.api.nvidia.com/v1/genai').replace(/\/+$/, ''),
      timeoutMs: toInt(env.IMAGE_TIMEOUT_MS, 30000, { min: 5000, max: 120000 }), // per model
    }),
    // Explore panel: festivals and holidays (Calendarific) and live events (Ticketmaster).
    calendarific: Object.freeze({
      apiKey: firstSet(env, ['CALENDARIFIC_API_KEY', 'CALENDARIFIC', 'CALENDRIFIC', 'CALENDRIFIC_API_KEY']),
      baseUrl: (env.CALENDARIFIC_BASE_URL?.trim() || 'https://calendarific.com/api/v2').replace(/\/+$/, ''),
    }),
    ticketmaster: Object.freeze({
      // Only the consumer key is needed for the Discovery API; the secret is never used.
      apiKey: firstSet(env, ['TICKETMASTER_API_KEY', 'TICKETMASTER_KEY', 'TICKMASTER_KEY', 'TICKMASTER_API_KEY']),
      baseUrl: (env.TICKETMASTER_BASE_URL?.trim() || 'https://app.ticketmaster.com/discovery/v2').replace(/\/+$/, ''),
    }),
    // Public India holidays and festivals (iCalendar). Set HOLIDAY_FEED_URL to empty to turn it off.
    holidayFeedUrl: (env.HOLIDAY_FEED_URL ?? DEFAULT_HOLIDAY_FEED).trim(),
  });
}
