import { noMotion } from './motion.ts';

/*
 * A film behind a hero's words (owner, 20 Nov 2026, after stockypro.com's paid-app heroes): the app's screens on a
 * board, seen through a camera per shot, a few shots of 4 s with hard cuts, looping. Home (laptop) and Mobile
 * (phone) bring their own screens, cameras and moves; this draws and runs them.
 *
 * Each shot has its own camera (`Cam`): a lean, a side tilt and a turn with perspective, a point of the picture
 * pinned to a point on screen, and a sharp ellipse around it. One sharp copy of the picture sits under a veil
 * that blurs everything outside the ellipse. Phones keep the laptop's angle; the picture is enlarged and moved
 * flat so the aim sits in a band above the words, and the drift is scaled down so it never races.
 *
 * For weak devices (owner, 20 Nov 2026: "check performance on lower devices"): shots are drawn only when needed
 * (the first at once, the others when the page is idle), shots off screen are not drawn at all (CSS), and on
 * 4 cores or fewer, 4 GB or less, or with data saver the blur veil is left out.
 *
 * `?t=9` freezes the film at 9 s for review; reduced motion and `?static` hold the film's rest pose. It pauses
 * off screen, in a hidden tab, and with its button.
 */

export type Aim = { ox: number; oy: number; cs: number };
/** A camera angle in the 1440 × 820 frame: lean, side tilt, turn, perspective, where the aim lands, the sharp ellipse. */
export type Angle = {
  rx: number;
  ry: number;
  rz: number;
  persp: number;
  pox: number;
  poy: number;
  sx: number;
  sy: number;
  mcx: number;
  mcy: number;
  mrx: number;
  mry: number;
  mturn: number;
};
export type Cam = Angle & Aim & { phone: Aim };
/** Where a shot looks: its screen's slot on the board, the point in that screen, the zoom; then the same on phones. */
export type ShotAim = {
  slot: number;
  x: number;
  y: number;
  cs: number;
  px: number;
  py: number;
  pcs: number;
};

/** One film: its class prefix (`hf`, `mb`), its shots in order, their cameras, how a shot is drawn, its rest pose. */
export interface Film {
  prefix: string;
  shots: string[];
  cams: Record<string, Cam>;
  /** The shot's picture, inside its scene: `<prefix>-copy` with the camera's layers, then `<prefix>-veil`. */
  draw: (shot: string) => string;
  /** The moment (ms) held still for reduced motion: usually the end of the story. */
  rest: number;
}

const FRAME_W = 1440;
const FRAME_H = 820;
/** How far the blur veil's mask reaches past the 1440 x 820 frame (screens up to 3840 px wide); the CSS matches it. */
const VEIL_PAD_X = 1240;
const VEIL_PAD_Y = 100;
const SHOT_MS = 4000;
/** Phones see the frame's middle; each shot's aim sits in a band above the words, sharp in a round spot. */
const PHONE_SX = 720;
const PHONE_SY = 225;
/** Phones scale the drift down by this much and the picture up by as much. */
const PHONE_DRIFT = 0.3;
const DEG = Math.PI / 180;

/** The cameras of a film, from its angles and its aims on a board whose slots are at `slotAt`. */
export function cameras(
  angles: Record<string, Angle>,
  aims: Record<string, ShotAim>,
  slotAt: (slot: number) => { x: number; y: number },
): Record<string, Cam> {
  return Object.fromEntries(
    Object.entries(aims).map(([id, a]) => {
      const o = slotAt(a.slot);
      const phone = { ox: o.x + a.px, oy: o.y + a.py, cs: a.pcs };
      return [id, { ...angles[id], ox: o.x + a.x, oy: o.y + a.y, cs: a.cs, phone }];
    }),
  );
}

/** Where a picture point lands on the laptop's screen: scale, then rotateZ, Y, X around the aim, then perspective. */
function onScreen(c: Cam, px: number, py: number): [number, number] {
  let x = (px - c.ox) * c.cs;
  let y = (py - c.oy) * c.cs;
  let z = 0;
  [x, y] = [
    x * Math.cos(c.rz * DEG) - y * Math.sin(c.rz * DEG),
    x * Math.sin(c.rz * DEG) + y * Math.cos(c.rz * DEG),
  ];
  [x, z] = [
    x * Math.cos(c.ry * DEG) + z * Math.sin(c.ry * DEG),
    -x * Math.sin(c.ry * DEG) + z * Math.cos(c.ry * DEG),
  ];
  [y, z] = [
    y * Math.cos(c.rx * DEG) - z * Math.sin(c.rx * DEG),
    y * Math.sin(c.rx * DEG) + z * Math.cos(c.rx * DEG),
  ];
  const f = c.persp / (c.persp - z);
  return [c.pox + (c.sx + x - c.pox) * f, c.poy + (c.sy + y - c.poy) * f];
}

/** Phones: the laptop's picture at the laptop's angle, only enlarged and moved flat so the aim sits in the band. */
function phoneLens(c: Cam): string {
  const [qx, qy] = onScreen(c, c.phone.ox, c.phone.oy);
  const s = c.phone.cs / (PHONE_DRIFT * c.cs);
  return `translate(${(PHONE_SX - s * qx).toFixed(2)}px, ${(PHONE_SY - s * qy).toFixed(2)}px) scale(${s.toFixed(4)})`;
}

type Ellipse = { cx: number; cy: number; rx: number; ry: number; turn: number };
/** The veil's mask: clear inside the turned ellipse, solid outside it, soft between. */
function veilMask({ cx, cy, rx, ry, turn }: Ellipse): string {
  // The mask reaches past the frame, so screens wider than 1440 px stay soft to their edges.
  const w = FRAME_W + 2 * VEIL_PAD_X;
  const h = FRAME_H + 2 * VEIL_PAD_Y;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><radialGradient id='f' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='1' gradientTransform='translate(${cx + VEIL_PAD_X} ${cy + VEIL_PAD_Y}) rotate(${turn}) scale(${rx} ${ry})'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='0.6' stop-color='#fff' stop-opacity='0'/><stop offset='0.8' stop-color='#fff' stop-opacity='0.25'/><stop offset='1' stop-color='#fff'/></radialGradient></defs><rect width='${w}' height='${h}' fill='url(#f)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const PHONE_MASK = veilMask({ cx: PHONE_SX, cy: PHONE_SY, rx: 230, ry: 160, turn: 0 });

/** The camera as the CSS variables a scene reads. */
function camStyle(c: Cam): string {
  const v: Record<string, string> = {
    '--rx': `${c.rx}deg`,
    '--ry': `${c.ry}deg`,
    '--rz': `${c.rz}deg`,
    '--persp': `${c.persp}px`,
    '--pox': `${c.pox}px`,
    '--poy': `${c.poy}px`,
    '--sx': `${c.sx}px`,
    '--sy': `${c.sy}px`,
    '--ox': `${c.ox}px`,
    '--oy': `${c.oy}px`,
    '--cs': String(c.cs),
    '--p-sx': `${PHONE_SX}px`,
    '--p-sy': `${PHONE_SY}px`,
    '--p-drift': String(PHONE_DRIFT),
    '--p-lens': phoneLens(c),
  };
  return Object.entries(v)
    .map(([k, val]) => `${k}:${val}`)
    .join(';');
}

/** Weak devices get the film without its blur veil. */
function weakDevice(): boolean {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return (
    (nav.hardwareConcurrency || 8) <= 4 ||
    (nav.deviceMemory || 8) <= 4 ||
    !!nav.connection?.saveData
  );
}

/** Empty scenes, one per shot, with their cameras and masks; `show(ms)` draws and shows the shot of that moment. */
function buildStage(film: Film, stage: HTMLElement) {
  const { prefix, shots, cams } = film;
  stage.innerHTML = shots
    .map(
      (id) =>
        `<div class="${prefix}-scene ${prefix}-shot-${id}" data-shot="${id}" style="${camStyle(cams[id])}"></div>`,
    )
    .join('');
  stage.inert = true;
  // The masks hold quotes, so they are set here, not in the markup.
  stage.style.setProperty('--p-mask', PHONE_MASK);
  const scenes = [...stage.querySelectorAll<HTMLElement>(`.${prefix}-scene`)];
  scenes.forEach((el) => {
    const c = cams[el.dataset.shot ?? ''];
    el.style.setProperty(
      '--mask',
      veilMask({ cx: c.mcx, cy: c.mcy, rx: c.mrx, ry: c.mry, turn: c.mturn }),
    );
  });
  const fill = (el: HTMLElement) => {
    if (!el.childElementCount) el.innerHTML = film.draw(el.dataset.shot ?? '');
  };
  const show = (ms: number) => {
    const on = Math.min(shots.length - 1, Math.floor(ms / SHOT_MS));
    fill(scenes[on]);
    scenes.forEach((s, i) => {
      const was = s.hasAttribute('data-on');
      s.toggleAttribute('data-on', i === on);
      if (i === on && !was) restart(s);
    });
  };
  return { scenes, fill, show };
}

/*
 * A hidden scene skips style updates (content-visibility), so CSS keeps its finished animations when it comes
 * back and the shot would stand still from the second loop on. Its animations start again here instead.
 */
function restart(scene: HTMLElement): void {
  for (const a of scene.getAnimations({ subtree: true })) a.currentTime = 0;
}

/** Draws one shot after another when the page is idle, so none is drawn at load but the first. */
function fillWhenIdle(scenes: HTMLElement[], fill: (el: HTMLElement) => void): void {
  const later = scenes.slice(1);
  const next = () => {
    const el = later.shift();
    if (!el) return;
    fill(el);
    idle(next, 3000);
  };
  idle(next, 3000);
}
function idle(fn: () => void, timeout: number): void {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 300);
}

/** One moment, every animation in the film paused there (review with `?t=`, or the rest pose). */
function hold(stage: HTMLElement, show: (ms: number) => void, ms: number, end: number): void {
  show(ms);
  const since = ms - Math.floor(Math.min(ms, end - 1) / SHOT_MS) * SHOT_MS;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const a of stage.getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = since;
      }
    }),
  );
}

/** The clock: shows each shot at its moment and loops; it holds its place while paused, unseen or not yet settled. */
function runClock(
  hero: HTMLElement,
  stage: HTMLElement,
  show: (ms: number) => void,
  film: Film,
): void {
  const end = film.shots.length * SHOT_MS;
  const scenes = [...stage.children];
  let held = 0;
  let startedAt = 0;
  let timers: number[] = [];
  let playing = true;
  let seen = true;
  let running = false;
  const go = (from: number) => {
    startedAt = performance.now() - from;
    show(from);
    timers = film.shots
      .map((_, i) => i * SHOT_MS)
      .filter((m) => m > from)
      .map((m) => window.setTimeout(() => show(m), m - from));
    timers.push(
      window.setTimeout(() => {
        scenes.forEach((s) => s.removeAttribute('data-on'));
        void stage.offsetWidth; // restarts the scenes' animations
        go(0);
      }, end - from),
    );
  };
  const run = () => {
    const should = playing && seen && hero.dataset.ready !== undefined;
    hero.toggleAttribute('data-paused', !should);
    if (should === running) return;
    running = should;
    if (should) return go(held);
    timers.forEach(clearTimeout);
    timers = [];
    held = Math.min(end, performance.now() - startedAt);
  };
  const btn = hero.querySelector<HTMLButtonElement>('[data-film-toggle]');
  btn?.addEventListener('click', () => {
    playing = !playing;
    btn.setAttribute('aria-pressed', String(!playing));
    btn.setAttribute(
      'aria-label',
      playing ? 'Pause the hero animation' : 'Play the hero animation',
    );
    run();
  });
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting && document.visibilityState === 'visible';
    run();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => {
    seen = document.visibilityState === 'visible';
    run();
  });
  whenSettled(() => {
    hero.dataset.ready = '';
    run();
  });
}

/** Once the font is in and the page is first idle: the film then fades in moving and the words blur in. */
function whenSettled(fn: () => void): void {
  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    fn();
  };
  const soon = () => idle(settle, 600);
  setTimeout(soon, 1000);
  void document.fonts.ready.then(soon, soon);
}

/** Starts the film in the hero (`[data-film-hero]`) whose stage is `.<prefix>-stage`. */
export function startFilm(film: Film): void {
  const hero = document.querySelector<HTMLElement>('[data-film-hero]');
  const stage = hero?.querySelector<HTMLElement>(`.${film.prefix}-stage`);
  if (!hero || !stage) return;
  if (weakDevice()) hero.dataset.lite = '';
  const { scenes, fill, show } = buildStage(film, stage);
  fill(scenes[0]);
  fillWhenIdle(scenes, fill);
  const t = Number(new URLSearchParams(location.search).get('t') ?? Number.NaN);
  let still: number | null = null;
  if (Number.isFinite(t)) still = t * 1000;
  else if (noMotion) still = film.rest;
  if (still === null) return runClock(hero, stage, show, film);
  hero.dataset.ready = '';
  hero.dataset.still = '';
  hold(stage, show, still, film.shots.length * SHOT_MS);
}
