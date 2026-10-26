// A small in-house icon set (24x24, outline style). Icons are built with createElementNS,
// so there is no external font or image, and nothing here can carry markup from user data.

const NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  layout: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  calendar: ['M7 3v3M17 3v3M4 9h16', 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'],
  wallet: ['M4 7h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z', 'M4 7V6a1 1 0 0 1 1-1h12', 'M16 13h2'],
  pie: ['M12 3v9h9a9 9 0 1 1-9-9z', 'M15 3.5A9 9 0 0 1 20.5 9H15V3.5z'],
  users: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 19c0-3 2.5-5 6-5s6 2 6 5', 'M16 5.2a3 3 0 0 1 0 5.6', 'M18 14.2c1.8.7 3 2.2 3 4.8'],
  pin: ['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  utensils: ['M6 3v7a2 2 0 0 0 4 0V3', 'M8 12v9', 'M17 3c-2 2-3 4.5-3 7h3v11'],
  sparkles: ['M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8L11 3z', 'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z'],
  camera: ['M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  music: ['M9 18V5l11-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  shirt: ['M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z'],
  mail: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M3 7l9 6 9-6'],
  gift: ['M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z', 'M3 8h18v3H3z', 'M12 8v13', 'M12 8c-1-3-5-4-5-1.5C7 8 9 8 12 8z', 'M12 8c1-3 5-4 5-1.5C17 8 15 8 12 8z'],
  truck: ['M2 6h11v10H2z', 'M13 9h4l3 3v4h-7', 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  shield: ['M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z', 'M9 12l2 2 4-4'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  heart: ['M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20z'],
  cake: ['M4 21h16', 'M5 21v-7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v7', 'M5 17c2 1.5 3.5 1.5 5 0s3-1.5 4.5 0 3 1.5 4.5 0', 'M12 13V9', 'M12 7c-1-1-1-2 0-3 1 1 1 2 0 3z'],
  megaphone: ['M3 11v3a1 1 0 0 0 1 1h2l8 4V6L6 10H4a1 1 0 0 0-1 1z', 'M17.5 9.5a4 4 0 0 1 0 5', 'M7 15l1 5h2l-1-4.5'],
  building: ['M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17', 'M15 9h3a1 1 0 0 1 1 1v11', 'M3 21h18', 'M9 7h2M9 11h2M9 15h2'],
  chat: ['M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8 9.5h8M8 12.5h5'],
  image: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 16l-5-5-8 8'],
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
  printer: ['M7 8V3h10v5', 'M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2', 'M7 14h10v7H7z'],
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4 18-7z'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  checklist: ['M9 6h11M9 12h11M9 18h11', 'M4 6l1.2 1.2L7 5.5M4 12l1.2 1.2L7 11.5M4 18l1.2 1.2L7 17.5'],
  bulb: ['M9 18h6M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'],
  alert: ['M12 4l9 16H3L12 4z', 'M12 10v4M12 17v.5'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  refresh: ['M20 11a8 8 0 0 0-14.5-3.5L4 9', 'M4 4v5h5', 'M4 13a8 8 0 0 0 14.5 3.5L20 15', 'M20 20v-5h-5'],
  lock: ['M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20c0-4 3.6-6 8-6s8 2 8 6'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
  compass: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15.5 8.5l-2 5-5 2 2-5 5-2z'],
  ticket: ['M4 7h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V8a1 1 0 0 1 1-1z', 'M14 7v2M14 11v2M14 15v2'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3c3 3 3 15 0 18', 'M12 3c-3 3-3 15 0 18'],
  rupee: ['M7 5h10M7 9h10M7 5c5 0 6 4 0 5l7 8'],
};

/** Returns an <svg> icon. Pass `label` only when the icon stands alone (otherwise it is decorative). */
export function icon(name, { size = 20, className = '', label } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', `icon ${className}`.trim());
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }
  for (const d of PATHS[name] ?? []) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** Fills every `[data-icon]` element in the page with its icon (used by static HTML). */
export function hydrateIcons(root = document) {
  for (const node of root.querySelectorAll('[data-icon]')) {
    if (node.querySelector(':scope > svg.icon')) continue;
    node.prepend(icon(node.dataset.icon, { size: Number(node.dataset.iconSize) || 20 }));
  }
}

/** Icon for each budget category, used in the budget table and checklist. */
export const CATEGORY_ICON = {
  venue: 'building',
  catering: 'utensils',
  decor: 'sparkles',
  photography: 'camera',
  attire: 'shirt',
  entertainment: 'music',
  invitations: 'mail',
  gifts: 'gift',
  logistics: 'truck',
};
