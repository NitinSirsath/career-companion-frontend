import { noMotion } from '../runtime/motion.ts';

/*
 * Your data (owner, 19-20 Nov 2026). The contents list marks the section being read (laptops) and names it in
 * the phone bar; the phone list closes after a tap. Each drawing's loop runs only while it is on screen, its
 * pause button stops it (back to the still pose), and nothing moves under reduced motion or `?static`.
 */
document.querySelectorAll<HTMLElement>('[data-loop]').forEach((box) => {
  const btn = box.querySelector<HTMLButtonElement>('[data-pause]');
  if (!btn) return;
  if (noMotion) {
    btn.hidden = true;
    return;
  }
  box.classList.add('dt-loops');
  new IntersectionObserver(([e]) => box.classList.toggle('dt-on', e.isIntersecting)).observe(box);
  btn.addEventListener('click', () => {
    const stop = !box.classList.contains('dt-stopped');
    box.classList.toggle('dt-stopped', stop);
    btn.setAttribute('aria-pressed', String(stop));
    const label = btn.getAttribute('aria-label') ?? '';
    btn.setAttribute('aria-label', label.replace(stop ? 'Pause' : 'Play', stop ? 'Play' : 'Pause'));
  });
});

const secs = [...document.querySelectorAll<HTMLElement>('.dt-sec[id]')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('.dt-toc a, .dt-otp a')];
const now = document.querySelector('[data-otp-now]');
const otp = document.querySelector<HTMLDetailsElement>('[data-otp]');
let queued = false;
function mark(): void {
  queued = false;
  if (!secs.length) return;
  const line = Math.max(170, innerHeight * 0.3);
  let cur = secs[0];
  secs.forEach((s) => {
    if (s.getBoundingClientRect().top <= line) cur = s;
  });
  links.forEach((a) => {
    const on = a.getAttribute('href') === `#${cur.id}`;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  if (now) now.textContent = cur.querySelector('h2')?.textContent ?? '';
}
addEventListener(
  'scroll',
  () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(mark);
  },
  { passive: true },
);
otp?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => (otp.open = false)));
mark();
