// The one content-security policy for the whole app. Express sends it for local/Node hosting, and
// vercel.json repeats it for static files on Vercel (a test keeps the two identical).
export const CSP_DIRECTIVES = Object.freeze({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  // data: for generated card art; Ticketmaster's image CDN for event pictures
  imgSrc: ["'self'", 'data:', 'https://*.ticketm.net'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
});

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The policy as a header value, e.g. "default-src 'self'; script-src 'self'; …". */
export const cspHeaderValue = () =>
  Object.entries(CSP_DIRECTIVES)
    .map(([name, values]) => `${kebab(name)} ${values.join(' ')}`)
    .join('; ');
