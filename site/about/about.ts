import { noMotion } from '../runtime/motion.ts';

/* About (owner, 20 Nov 2026): the drawing's lifted mail floats slowly while it is on screen; still with reduced motion or `?static`. */
const fig = document.querySelector<HTMLElement>('[data-fig]');
if (fig && !noMotion && 'IntersectionObserver' in window)
  new IntersectionObserver(([e]) => fig.classList.toggle('on', e.isIntersecting)).observe(fig);
