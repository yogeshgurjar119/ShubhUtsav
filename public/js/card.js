import { postJson } from './api.js';
import { byId } from './dom.js';
import { formatDate } from './format.js';

const WIDTH = 896;
const HEIGHT = 1088;
const SERIF = "Georgia, 'Noto Serif', 'Noto Serif Devanagari', serif";
const INK = '#3b1020';
const DEFAULT_THEME = '';

const GRADIENTS = {
  wedding: ['#4a0b22', '#a3262f', '#e8a33d'],
  birthday: ['#ff6b57', '#ffa94d', '#ffe27a'],
  community: ['#c4620a', '#e8871e', '#3a8a58'],
  public: ['#1e1b6b', '#7a2a9a', '#e8a33d'],
};
const OCCASION = { wedding: 'Wedding celebration', birthday: 'Birthday celebration', community: 'Community celebration', public: 'Open to everyone' };

/** Splits text into lines no wider than `maxWidth` (falls back to characters for unspaced scripts). */
function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, eventType, image) {
  if (image) {
    const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
    return;
  }
  const [a, b, c] = GRADIENTS[eventType] ?? GRADIENTS.wedding;
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, a);
  gradient.addColorStop(0.55, b);
  gradient.addColorStop(1, c);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** Draws lines centred at `y`; returns the y position after the block. */
function centred(ctx, lines, y, lineHeight) {
  let cursor = y;
  for (const line of lines) {
    ctx.fillText(line, WIDTH / 2, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

function draw(ctx, { eventType, title, line, dateText, image }) {
  drawBackground(ctx, eventType, image);

  // A soft panel keeps the text readable on any background.
  const inset = 110;
  roundedRect(ctx, inset, inset, WIDTH - inset * 2, HEIGHT - inset * 2, 36);
  ctx.fillStyle = 'rgba(255, 250, 243, 0.92)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#b8860b';
  ctx.stroke();

  const textWidth = WIDTH - inset * 2 - 100;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;

  ctx.font = `34px ${SERIF}`;
  let y = centred(ctx, ['॥ शुभ आमंत्रण ॥'], 215, 50);

  ctx.font = `italic 32px ${SERIF}`;
  y = centred(ctx, ['You are warmly invited to'], y + 30, 44);

  ctx.font = `600 26px ${SERIF}`;
  ctx.fillStyle = '#8a1c3c';
  y = centred(ctx, [(OCCASION[eventType] ?? 'Celebration').toUpperCase()], y + 12, 40);

  // The title shrinks until it fits in at most three lines.
  ctx.fillStyle = INK;
  let size = 84;
  let titleLines = [];
  for (; size >= 40; size -= 4) {
    ctx.font = `700 ${size}px ${SERIF}`;
    titleLines = wrap(ctx, title, textWidth);
    if (titleLines.length <= 3) break;
  }
  y = centred(ctx, titleLines, y + 90, size * 1.15);

  ctx.fillStyle = '#b8860b';
  ctx.fillRect(WIDTH / 2 - 60, y + 6, 120, 4);

  ctx.fillStyle = INK;
  ctx.font = `600 38px ${SERIF}`;
  y = centred(ctx, [dateText], y + 70, 52);

  if (line) {
    ctx.font = `30px ${SERIF}`;
    y = centred(ctx, wrap(ctx, line, textWidth).slice(0, 3), y + 14, 44);
  }

  ctx.font = `italic 22px ${SERIF}`;
  ctx.fillStyle = '#6b4a52';
  ctx.fillText('Made with ShubhUtsav', WIDTH / 2, HEIGHT - inset - 36);
}

/**
 * Invitation-card builder. The words are drawn on a canvas in the browser (image models draw
 * unreliable lettering); the optional AI image is only the background. Works without AI too.
 */
export function setupCard({ getEvent, imageAvailable }) {
  const canvas = byId('card-canvas');
  const ctx = canvas.getContext('2d');
  const titleInput = byId('card-title');
  const lineInput = byId('card-line');
  const themeSelect = byId('card-theme');
  const artButton = byId('card-art-btn');
  const downloadButton = byId('card-download');
  const status = byId('card-status');

  let image = null;
  let busy = false;

  function render() {
    const event = getEvent();
    if (!event) return;
    const title = titleInput.value.trim() || 'Your celebration';
    const line = lineInput.value.trim();
    const dateText = formatDate(event.eventDate);
    draw(ctx, { eventType: event.eventType, title, line, dateText, image });
    canvas.setAttribute('aria-label', `Invitation card preview: ${title}, ${dateText}${line ? `, ${line}` : ''}`);
  }

  titleInput.addEventListener('input', render);
  lineInput.addEventListener('input', render);

  artButton.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    artButton.disabled = true;
    status.textContent = 'Painting your background. This can take up to a minute…';
    try {
      const body = { event: getEvent() };
      if (themeSelect.value !== DEFAULT_THEME) body.theme = themeSelect.value;
      const { image: art } = await postJson('/api/card-art', body);
      const loaded = new Image();
      await new Promise((resolve, reject) => {
        loaded.onload = resolve;
        loaded.onerror = () => reject(new Error('The generated image could not be displayed.'));
        loaded.src = `data:${art.mime};base64,${art.data}`;
      });
      image = loaded;
      render();
      status.textContent = 'Background ready. You can create another one for a different look.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      artButton.disabled = !imageAvailable();
    }
  });

  downloadButton.addEventListener('click', () => {
    render();
    canvas.toBlob((blob) => {
      if (!blob) {
        status.textContent = 'Could not create the file. Please try again.';
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'shubhutsav-invitation.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  });

  /** Called for every new plan: resets the text, theme list and background. */
  function reset({ themes }) {
    image = null;
    titleInput.value = '';
    lineInput.value = '';
    themeSelect.replaceChildren(new Option('Classic festive', DEFAULT_THEME), ...themes.map((t) => new Option(t.title, t.title)));
    artButton.disabled = !imageAvailable();
    status.textContent = imageAvailable() ? '' : 'AI backgrounds are not available right now. You can still download the classic card.';
    render();
  }

  return { reset };
}
