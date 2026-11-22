import { startAlert } from './alert.ts';
import { SampleApp } from './app.ts';
import type { View } from './data.ts';
import { buildFrames } from './frames.ts';

/** Every example on the page, by its element (`[data-sample]`). */
export const examples = new Map<Element, SampleApp>();

let started = false;

/** Draws every example on the page once (Mobile starts it itself, before it opens a mail in one of them). */
export function startExamples(): void {
  if (started) return;
  started = true;
  // Draw the phones first, so each example starts at its phone's size.
  buildFrames();
  document.querySelectorAll<HTMLElement>('[data-sample]').forEach((el) => {
    examples.set(el, new SampleApp(el, { view: (el.dataset.sample || 'mails') as View }));
  });
  document.querySelectorAll<HTMLElement>('[data-alert]').forEach((alert) => {
    const phoneEl = alert.parentElement?.querySelector<HTMLElement>('[data-sample]');
    const app = phoneEl && examples.get(phoneEl);
    if (phoneEl && app) startAlert(alert, phoneEl, app);
  });
}
