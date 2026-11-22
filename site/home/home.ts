import { startStory } from './story.ts';
import { startFilm } from './film.ts';
import { buildFrames } from '../example/frames.ts';

/* Home (owner, 19-20 Nov 2026): the hero's laptop film and the one-mail story stage. */
startFilm();
startStory();
// The Mobile cell's phone: a real iPhone frame around a still picture (owner, 22 Nov 2026).
buildFrames('iphone');
