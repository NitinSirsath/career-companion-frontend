import { startExamples } from './example/index.ts';
import { startChrome } from './runtime/chrome.ts';
import { noMotion, startReveal } from './runtime/motion.ts';
import { startToc } from './runtime/toc.ts';

/*
 * The product site in the browser (owner, 31 Oct and 1 Nov 2026). The pages arrive whole from the build;
 * this adds the theme switch, the phone menu, the header line, the reveal motion, the Privacy contents
 * and the live example of the app on Home.
 * No server calls, nothing kept but the theme choice.
 */
if (noMotion) document.documentElement.classList.add('no-motion');
startChrome();
startReveal();
startToc(!noMotion);
startExamples();
