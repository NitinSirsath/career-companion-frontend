import { noMotion } from '../runtime/motion.ts';

/**
 * "One mail, start to finish" (owner, 19 Nov 2026): the story plays in once when its stage comes into
 * view; the replay button plays it again. Reduced motion and `?static` show the end at once.
 */
export function startStory(): void {
  const st = document.querySelector<HTMLElement>('[data-story]');
  if (!st) return;
  const play = () => {
    st.classList.remove('play', 'end');
    void st.offsetWidth;
    st.classList.add(noMotion ? 'end' : 'play');
  };
  if (noMotion) st.classList.add('end');
  else
    new IntersectionObserver(
      ([e], o) => {
        if (!e.isIntersecting) return;
        play();
        o.disconnect();
      },
      { threshold: 0.45 },
    ).observe(st);
  st.querySelector('[data-story-replay]')?.addEventListener('click', play);
}
