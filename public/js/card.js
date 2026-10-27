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
const OCCASION = {
  wedding: 'Wedding celebration',
  birthday: 'Birthday celebration',
  community: 'Community celebration',
  public: 'Open to everyone',
};

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

function roundedRect(ctx, { x, y, w, h, r }) {
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
  roundedRect(ctx, { x: inset, y: inset, w: WIDTH - inset * 2, h: HEIGHT - inset * 2, r: 36 });
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

/** Loads a generated image (base64) into an <img> that is safe to draw on the canvas. */
function loadImage({ mime, data }) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The generated image could not be displayed.'));
    image.src = `data:${mime};base64,${data}`;
  });
}

/** Saves the canvas as a PNG file. Calls `onError` if the browser cannot make the file. */
function downloadCanvas(canvas, onError) {
  canvas.toBlob((blob) => {
    if (!blob) {
      onError('Could not create the file. Please try again.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shubhutsav-invitation.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/** Draws the card from the current text fields and event, and keeps the canvas description up to date. */
function createPreview({ getEvent, fields }) {
  const canvas = byId('card-canvas');
  const ctx = canvas.getContext('2d');
  let image = null;

  function render() {
    const event = getEvent();
    if (!event) return;
    const title = fields.title.value.trim() || 'Your celebration';
    const line = fields.line.value.trim();
    const dateText = formatDate(event.eventDate);
    draw(ctx, { eventType: event.eventType, title, line, dateText, image });
    canvas.setAttribute('aria-label', `Invitation card preview: ${title}, ${dateText}${line ? `, ${line}` : ''}`);
  }

  fields.title.addEventListener('input', render);
  fields.line.addEventListener('input', render);

  return {
    canvas,
    render,
    setImage(next) {
      image = next;
      render();
    },
  };
}

/**
 * Invitation-card builder. The words are drawn on a canvas in the browser (image models draw
 * unreliable lettering); the optional AI image is only the background. Works without AI too.
 */
export function setupCard({ getEvent, imageAvailable }) {
  const fields = { title: byId('card-title'), line: byId('card-line'), theme: byId('card-theme') };
  const artButton = byId('card-art-btn');
  const status = byId('card-status');
  const preview = createPreview({ getEvent, fields });
  let busy = false;
  let session = 0; // bumped for every new plan, so a late answer for the old plan is ignored

  async function createArt() {
    if (busy) return;
    const mine = session;
    busy = true;
    artButton.disabled = true;
    status.textContent = 'Painting your background. This can take up to a minute…';
    try {
      const body = { event: getEvent() };
      if (fields.theme.value !== DEFAULT_THEME) body.theme = fields.theme.value;
      const { image } = await postJson('/api/card-art', body);
      const loaded = await loadImage(image);
      if (mine !== session) return;
      preview.setImage(loaded);
      status.textContent = 'Background ready. You can create another one for a different look.';
    } catch (error) {
      if (mine === session) status.textContent = error.message;
    } finally {
      if (mine === session) {
        busy = false;
        artButton.disabled = !imageAvailable();
      }
    }
  }

  artButton.addEventListener('click', createArt);
  byId('card-download').addEventListener('click', () => {
    preview.render();
    downloadCanvas(preview.canvas, (message) => {
      status.textContent = message;
    });
  });

  /** Called for every new plan: resets the text, theme list and background. */
  function reset({ themes }) {
    session += 1;
    busy = false;
    fields.title.value = '';
    fields.line.value = '';
    fields.theme.replaceChildren(
      new Option('Classic festive', DEFAULT_THEME),
      ...themes.map((theme) => new Option(theme.title, theme.title)),
    );
    artButton.disabled = !imageAvailable();
    status.textContent = imageAvailable()
      ? ''
      : 'AI backgrounds are not available right now. You can still download the classic card.';
    preview.setImage(null);
  }

  return { reset };
}
