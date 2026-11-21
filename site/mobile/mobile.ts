import { examples, startExamples } from '../example/index.ts';
import { startFilm } from './film.ts';
import { playWhileSeen } from '../runtime/motion.ts';

/*
 * The Mobile page (owner, 19-20 Nov 2026). The hero's film (film.ts); the framed picture's front phone
 * starts on a mail (`data-open-mail`). The page keeps its scroll: this runs before the visitor does anything.
 */
startExamples();
const y = scrollY;
document.querySelectorAll<HTMLElement>('[data-open-mail]').forEach((el) => {
  examples.get(el)?.open(el.dataset.openMail ?? '');
  el.classList.remove('used');
});
(document.activeElement as HTMLElement | null)?.blur();
scrollTo(0, y);
startFilm();
playWhileSeen(document.querySelectorAll<HTMLElement>('[data-live]'));
