import { icon } from '../parts/icons.ts';

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
    if (target.closest('.menu-btn')) setSheet(!document.getElementById('site-sheet')?.classList.contains('open'));
    else if (target.closest('#site-sheet a')) setSheet(false);
  });
  matchMedia('(min-width: 900px)').addEventListener('change', (q) => {
    if (q.matches) setSheet(false);
  });

  // The header's bottom line shows only once the page has scrolled.
  const hdr = document.querySelector('.hdr');
  const onScroll = () => hdr?.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
