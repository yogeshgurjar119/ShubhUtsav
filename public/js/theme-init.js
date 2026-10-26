// Runs before the page paints (plain script, no module) so the saved or system theme
// is applied with no flash of the wrong colours.
(() => {
  let dark = false;
  try {
    const saved = localStorage.getItem('shubhutsav:theme');
    dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    /* storage blocked: follow the system setting */
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
