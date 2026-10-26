const PALETTES = {
  wedding: 'deep maroon, antique gold and marigold orange',
  birthday: 'bright coral, turquoise and sunshine yellow',
  community: 'warm saffron, leaf green and cream',
  public: 'electric indigo, magenta and gold',
};

const MOTIFS = {
  wedding: 'paisley, lotus flowers, marigold garlands and brass lamps',
  birthday: 'balloons, confetti, streamers and stars',
  community: 'diyas, rangoli patterns and festive bunting',
  public: 'stage lights, festival flags, pennants and confetti',
};

/** Keeps a theme to plain words so it cannot smuggle extra instructions into the image prompt. */
export function sanitizeTheme(theme = '') {
  return theme
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N} '&,.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * Builds the prompt for the invitation-card background. Text is added later in the browser,
 * because image models draw unreliable lettering, so the art must leave the centre empty.
 */
export function buildCardArtPrompt({ eventType, theme }) {
  const cleanTheme = sanitizeTheme(theme);
  return [
    `Elegant decorative invitation card background featuring ${MOTIFS[eventType]},`,
    `colour palette of ${PALETTES[eventType]}`,
    cleanTheme ? `, inspired by the theme "${cleanTheme}".` : '.',
    'Ornate border around the edges and a large, calm, empty space in the centre.',
    'Flat vector illustration style, soft lighting, high detail.',
    'No text, no letters, no numbers, no logos, no watermark, no people.',
  ].join(' ');
}
