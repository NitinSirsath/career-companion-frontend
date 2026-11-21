import { playWhileSeen } from '../runtime/motion.ts';

/*
 * The NorthList Posts page (owner, 21 Nov 2026): its one picture, a single draft, loops only while on screen
 * (`.live`); under less motion it shows the posted end state.
 */
playWhileSeen(document.querySelectorAll<HTMLElement>('[data-live]'));
