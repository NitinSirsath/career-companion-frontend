import { playWhileSeen } from '../runtime/motion.ts';

/*
 * The NorthList Apply page (owner, 21 Nov 2026): the small pictures under the run loop only while on screen
 * (`.live`), as on Mobile. The run picture itself is played by runtime/pictures.ts, loaded from main.ts.
 */
playWhileSeen(document.querySelectorAll<HTMLElement>('[data-live]'));
