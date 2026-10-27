import { icon } from './icons.js';

const KEY = 'shubhutsav:theme';

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/**
 * Light/dark switch. The first choice follows the system setting (done early by theme-init.js);
 * after the visitor clicks the button, their choice is remembered on this device.
 */
export function setupTheme(button) {
  const root = document.documentElement;
  const dark = window.matchMedia('(prefers-color-scheme: dark)');

  function paint() {
    const isDark = root.dataset.theme === 'dark';
    // The icon shows what you will switch to; the label says the same in words.
    button.replaceChildren(
      icon(isDark ? 'sun' : 'moon', { size: 20 }),
      Object.assign(document.createElement('span'), {
        className: 'nav-text',
        textContent: isDark ? 'Light mode' : 'Dark mode',
      }),
    );
    button.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    button.title = button.getAttribute('aria-label');
  }

  function apply(theme, { save }) {
    root.dataset.theme = theme;
    if (save) {
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        /* the choice just will not be remembered */
      }
    }
    paint();
  }

  button.addEventListener('click', () => apply(root.dataset.theme === 'dark' ? 'light' : 'dark', { save: true }));
  // Until the visitor chooses, keep following the system setting.
  dark.addEventListener('change', (event) => {
    if (!read()) apply(event.matches ? 'dark' : 'light', { save: false });
  });
  paint();
}
