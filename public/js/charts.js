// Small SVG charts. Colours come from CSS classes (seg-1…seg-9), so themes control them
// and there are no inline styles. Every chart is paired with text, so colour is never the only cue.

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

export const SEGMENT_COUNT = 9;

/**
 * Donut chart. `segments` is [{ value }]; each gets class `seg-N`.
 * `centre` is [big text, small text] drawn in the middle.
 */
export function donut(segments, { centre = [], label }) {
  const size = 200;
  const radius = 76;
  const stroke = 28;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'donut', role: 'img', 'aria-label': label });
  svg.append(svgEl('circle', { cx: 100, cy: 100, r: radius, fill: 'none', class: 'donut-track', 'stroke-width': stroke }));

  let offset = 0;
  segments.forEach((segment, index) => {
    const length = (segment.value / total) * circumference;
    // A 1px gap between segments keeps neighbouring colours distinguishable.
    const visible = Math.max(length - 1, 0);
    svg.append(
      svgEl('circle', {
        cx: 100,
        cy: 100,
        r: radius,
        fill: 'none',
        class: `seg seg-${(index % SEGMENT_COUNT) + 1}`,
        'stroke-width': stroke,
        'stroke-dasharray': `${visible} ${circumference - visible}`,
        'stroke-dashoffset': -offset,
        transform: 'rotate(-90 100 100)',
      }),
    );
    offset += length;
  });

  const [big, small] = centre;
  if (big) {
    const main = svgEl('text', { x: 100, y: small ? 98 : 108, 'text-anchor': 'middle', class: 'donut-big' });
    main.textContent = big;
    svg.append(main);
  }
  if (small) {
    const sub = svgEl('text', { x: 100, y: 120, 'text-anchor': 'middle', class: 'donut-small' });
    sub.textContent = small;
    svg.append(sub);
  }
  return svg;
}

/** Progress ring for a value between 0 and `max`. */
export function ring(value, max, { label }) {
  const size = 96;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const fraction = max > 0 ? Math.min(value / max, 1) : 0;

  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'ring', role: 'img', 'aria-label': label });
  svg.append(svgEl('circle', { cx: 48, cy: 48, r: radius, fill: 'none', class: 'donut-track', 'stroke-width': 9 }));
  svg.append(
    svgEl('circle', {
      cx: 48,
      cy: 48,
      r: radius,
      fill: 'none',
      class: 'ring-value',
      'stroke-width': 9,
      'stroke-linecap': 'round',
      'stroke-dasharray': `${fraction * circumference} ${circumference}`,
      transform: 'rotate(-90 48 48)',
    }),
  );
  const text = svgEl('text', { x: 48, y: 54, 'text-anchor': 'middle', class: 'ring-text' });
  text.textContent = `${Math.round(fraction * 100)}%`;
  svg.append(text);
  return svg;
}
