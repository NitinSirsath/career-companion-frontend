import { startChrome } from './runtime/chrome.ts';
import { noMotion, startReveal } from './runtime/motion.ts';

/*
 * The product site in the browser (dark only since 19-20 Nov 2026). The pages arrive whole from the build;
 * this adds the phone menu, the header line and the reveal motion. The working example of the app (Home,
 * Mobile) and NorthList Apply's run picture load only on the pages that show them.
 * No server calls, nothing kept in the browser.
 */
if (noMotion) document.documentElement.classList.add('no-motion');
startChrome();
startReveal();
if (document.querySelector('[data-sample]')) void import('./example/index.ts').then((m) => m.startExamples());
if (document.querySelector('[data-rundemo]')) void import('./runtime/pictures.ts').then((m) => m.startPictures());
