import { icon } from '../parts/icons.ts';

/* Light by default, also on dark devices; Dark on request. The choice is the only thing kept in the browser. */
const KEY = 'northlist-site-theme';
const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function syncThemeButtons(): void {
  document
    .querySelectorAll<HTMLElement>('[data-theme-set]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === current())));
}

function setTheme(theme: string): void {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // A private window may refuse; the switch still works on this page.
  }
  syncThemeButtons();
}

/** The phone menu: full screen, closes on a link tap and when the window grows past 900 px. */
function setSheet(open: boolean): void {
  const sheet = document.getElementById('site-sheet');
  const btn = document.querySelector('.menu-btn');
  if (!sheet || !btn) return;
  sheet.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
  btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  btn.innerHTML = icon(open ? 'close' : 'menu', 20);
  document.body.style.overflow = open ? 'hidden' : '';
}

export function startChrome(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    const set = target.closest<HTMLElement>('[data-theme-set]');
    if (set) setTheme(set.dataset.themeSet ?? 'light');
    if (target.closest('.menu-btn')) setSheet(!document.getElementById('site-sheet')?.classList.contains('open'));
    else if (target.closest('#site-sheet a')) setSheet(false);
  });
  matchMedia('(min-width: 900px)').addEventListener('change', (q) => {
    if (q.matches) setSheet(false);
  });
  syncThemeButtons();

  // The header's bottom line shows only once the page has scrolled.
  const hdr = document.querySelector('.hdr');
  const onScroll = () => hdr?.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
