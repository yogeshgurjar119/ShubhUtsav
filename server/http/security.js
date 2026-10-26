import { HttpError } from './errors.js';

/** Turns off browser features the app never uses (camera, microphone, location, payments…). */
export function permissionsPolicy(req, res, next) {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), interest-cohort=()',
  );
  next();
}

/** API answers contain personal event details, so browsers and proxies must not store them. */
export function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * State-changing API calls must be JSON. A strict content type also means a plain HTML form on
 * another site cannot send a request this API will accept.
 */
export function requireJson(req, res, next) {
  const hasBody = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH';
  if (hasBody && !req.is('application/json')) {
    return next(new HttpError(415, 'unsupported_media_type', 'Send the request as application/json'));
  }
  return next();
}
