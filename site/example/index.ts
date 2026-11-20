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
  // `data-fit-phone` (owner, 19 Nov 2026: follow linear.app on phones): the laptop picture stays on phones too,
  // scaled to half and cut off at the right edge.
  const always = box.hasAttribute('data-fit-phone');
  const apply = () => {
    if (phoneQ.matches && !always) {
      app.style.width = '';
      app.style.transform = '';
      box.style.height = '';
      return;
    }
    const w = box.clientWidth;
    if (!w) return;
    let floor = 0;
    if (w < 600) floor = always ? 0.5 : 0.56;
    else if (w < 1000) floor = 0.74;
    const scale = w < BASE_W ? Math.max(floor, w / BASE_W) : 1;
    app.style.width = `${w < BASE_W ? BASE_W : w}px`;
    app.style.transform = scale === 1 ? '' : `scale(${scale})`;
    box.style.height = `${Math.ceil(BASE_H * scale)}px`;
  };
  new ResizeObserver(apply).observe(box);
  phoneQ.addEventListener('change', apply);
  apply();
}

let started = false;

/** Draws every example on the page once (Mobile starts it itself, before it opens a mail in one of them). */
export function startExamples(): void {
  if (started) return;
  started = true;
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
