import { onReplay, whenSeen } from '../runtime/motion.ts';
import type { SampleApp } from './app.ts';

/*
 * "On your phone, like an app": an alert arrives, and a moment later it opens the mail by itself, unless
 * the visitor got there first. Tapping the alert opens it at once. Using the phone app moves the alert
 * out of the way, as a real one would; a swipe is a page scroll, not a use. The replay button plays it again.
 */
export function startAlert(alert: HTMLElement, phoneEl: HTMLElement, app: SampleApp): void {
  let run = 0;
  const openMail = () => {
    alert.classList.remove('show', 'press');
    app.open('brightwave');
  };
  const play = (still: boolean) => {
    const my = ++run;
    app.reset();
    alert.classList.remove('show', 'press');
    if (still) return alert.classList.add('show');
    setTimeout(() => {
      if (my !== run) return;
      alert.classList.add('show');
      setTimeout(() => {
        if (my !== run || app.touched) return;
        alert.classList.add('press');
        setTimeout(() => my === run && !app.touched && openMail(), 280);
      }, 2200);
    }, 900);
  };
  // The visitor's own tap: open the mail, let its page scroll, and move focus to its title.
  alert.addEventListener('click', () => {
    run += 1;
    phoneEl.classList.add('used');
    openMail();
    phoneEl.querySelector<HTMLElement>('.sa-ppage .sa-h1')?.focus({ preventScroll: true });
  });
  alert.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    alert.click();
  });
  const stop = () => {
    run += 1;
    alert.classList.remove('show', 'press');
  };
  for (const t of ['click', 'keydown', 'focusin']) phoneEl.addEventListener(t, stop, true);
  whenSeen(alert.parentElement ?? alert, play, 0.4);
  onReplay('phone', () => play(false));
}
