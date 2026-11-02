import { noMotion, onReplay } from '../runtime/motion.ts';
import { startAlert } from './alert.ts';
import { SampleApp } from './app.ts';
import type { View } from './data.ts';
import { buildFrames } from './frames.ts';

/** Every example on the page, by its element (`[data-sample]`). */
export const examples = new Map<Element, SampleApp>();

/*
 * The hero picture (owner, 1 Nov 2026: mobile first). Phones get the real phone layout at real size.
 * Tablets and laptops get the laptop layout at 1120 px: below that it is scaled down, on tablets to no
 * less than 74%, and cropped at the screen edge.
 */
const BASE_W = 1120;
const BASE_H = 642;
function fit(box: HTMLElement): void {
  const app = box.querySelector<HTMLElement>('[data-sample]');
  if (!app) return;
  app.style.transformOrigin = '0 0';
  const phoneQ = matchMedia('(max-width: 599px)');
  const apply = () => {
    if (phoneQ.matches) {
      app.style.width = '';
      app.style.transform = '';
      box.style.height = '';
      return;
    }
    const w = box.clientWidth;
    if (!w) return;
    let floor = 0;
    if (w < 1000) floor = w < 600 ? 0.56 : 0.74;
    const scale = w < BASE_W ? Math.max(floor, w / BASE_W) : 1;
    app.style.width = `${w < BASE_W ? BASE_W : w}px`;
    app.style.transform = scale === 1 ? '' : `scale(${scale})`;
    box.style.height = `${Math.ceil(BASE_H * scale)}px`;
  };
  new ResizeObserver(apply).observe(box);
  phoneQ.addEventListener('change', apply);
  apply();
}

export function startExamples(): void {
  // Draw the phones and size the hero picture first, so each example starts in the right layout.
  buildFrames();
  document.querySelectorAll<HTMLElement>('.sa-fit').forEach(fit);
  document.querySelectorAll<HTMLElement>('[data-sample]').forEach((el) => {
    const app = new SampleApp(el, {
      view: (el.dataset.sample || 'mails') as View,
      phone: el.hasAttribute('data-phone'),
      autoplay: el.dataset.autoplay ?? null,
    });
    examples.set(el, app);
  });
  document.querySelectorAll<HTMLElement>('[data-alert]').forEach((alert) => {
    const phoneEl = alert.parentElement?.querySelector<HTMLElement>('[data-sample]');
    const app = phoneEl && examples.get(phoneEl);
    if (phoneEl && app) startAlert(alert, phoneEl, app);
  });
  const hero = document.querySelector('.sa-fit [data-sample]');
  const heroApp = hero ? examples.get(hero) : undefined;
  /*
   * Hero build-in on load (the phone frame on phones, the laptop picture on tablets and laptops): while the
   * page intro plays (`html.intro`, set in the page head), the hero app waits empty, then builds itself
   * 1.3 s after the intro starts, as its picture fades in. If a scroll ends the intro early, it builds at once.
   */
  const html = document.documentElement;
  if (heroApp && html.classList.contains('intro') && !noMotion) {
    heroApp.holdBuild();
    let timer = 0;
    const watch = new MutationObserver(() => {
      if (html.classList.contains('intro-go') && !timer) timer = window.setTimeout(() => heroApp.playBuild(), 1300);
      if (html.classList.contains('intro')) return;
      watch.disconnect();
      clearTimeout(timer);
      heroApp.playBuild();
    });
    watch.observe(html, { attributes: true, attributeFilter: ['class'] });
  }
  // The hero's replay button: back to the start, the build-in again, then the new mail arrives.
  onReplay('hero', () => {
    if (!heroApp) return;
    heroApp.reset();
    if (!noMotion) {
      heroApp.holdBuild();
      heroApp.playBuild();
    }
    heroApp.play();
  });
}
