import { NEW_MAIL, startState, type State, type View } from '../example/data.ts';
import { laptop } from '../example/laptop.ts';
import { cameras, startFilm as runFilm, type Angle, type ShotAim } from '../runtime/film.ts';

/*
 * Home's hero film (owner, 20 Nov 2026: "it should be great and will use laptop"), the same way as the
 * Mobile hero and stockypro.com's paid-app heroes (FilmHero): the laptop app behind the words, four shots
 * of 4 s with hard cuts, a 16 s loop. One story, all in the app today, from the example's own data:
 *   1. 0–4 s   Mails: Meera Shah's mail from Fernhill pushes in on top, with its next step;
 *   2. 4–8 s   the mail: the next step "Suggest a time for a call" and the AI's reply filling in;
 *   3. 8–12 s  Applications: the Recruiter contact filter folds the list to Fernhill and Lumen Health;
 *   4. 12–16 s Dashboard: the camera drifts over Your progress and the running total; today's reply arrives.
 * Each shot has its own camera and move; its screen sits among the app's other screens (a board), so the
 * frame is never empty. Two copies per shot, soft and sharp under a turned focus ellipse.
 * `?t=9` freezes the film at 9 s; reduced motion and `?static` hold the end of shot 4. It pauses off
 * screen, in a hidden tab, and with the button.
 */
/* The board: laptop screens, 3 across and 2 down; the story's screen takes its shot's slot. */
export const SCR_W = 1120;
export const SCR_H = 700;
const GAP = 96;
const COLS = 3;
export const BOARD_W = COLS * SCR_W + (COLS - 1) * GAP;
const slotAt = (slot: number) => ({ x: (slot % COLS) * (SCR_W + GAP), y: Math.floor(slot / COLS) * (SCR_H + GAP) });

/* Four angles, one per shot: stockypro.com's calibrated Desk and Leads cameras, a flatter low view, and Leads mirrored. */
const ANGLES: Record<string, Angle> = {
  mails: { rx: 49.314, ry: 22.819, rz: -28.077, persp: 5260.7, pox: 1467.8, poy: 676.4, sx: 700, sy: 250, mcx: 720, mcy: 290, mrx: 780, mry: 240, mturn: 3 },
  // Owner, 20 Nov 2026: the low, flat view did not work; now leaning back and turned a little left, gentler than shot 1
  mail: { rx: 54, ry: 8, rz: -36, persp: 4600, pox: 1200, poy: 760, sx: 820, sy: 300, mcx: 820, mcy: 300, mrx: 760, mry: 230, mturn: -14 },
  // Owner, 20 Nov 2026: scenes 3 and 4 redone calm like 1 and 2 (one steady move, no swing or zoom change). 3 leans back, falling to the right.
  apps: { rx: 50, ry: -12, rz: 30, persp: 4800, pox: 300, poy: 760, sx: 720, sy: 300, mcx: 720, mcy: 300, mrx: 780, mry: 230, mturn: 18 },
  // 4: leaning back, turned left like scene 1, close on Your progress and the running total
  dash: { rx: 46, ry: 18, rz: -22, persp: 5000, pox: 1300, poy: 700, sx: 720, sy: 280, mcx: 720, mcy: 290, mrx: 860, mry: 300, mturn: 2 },
};
/** Each shot: its screen's slot, the point to aim at in that screen (its own px), the zoom; then the phone's aim. */
const AIMS: Record<string, ShotAim> = {
  mails: { slot: 1, x: 520, y: 250, cs: 1.3, px: 430, py: 250, pcs: 0.95 },
  mail: { slot: 4, x: 900, y: 300, cs: 1.5, px: 900, py: 300, pcs: 1.05 },
  apps: { slot: 1, x: 480, y: 300, cs: 1.4, px: 420, py: 300, pcs: 1.0 },
  dash: { slot: 4, x: 640, y: 380, cs: 1.6, px: 400, py: 360, pcs: 1.1 },
};
const CAMS = cameras(ANGLES, AIMS, slotAt);
/* ---------- The pictures: the laptop app's own screens (site/example), drawn flat ---------- */
const screen = (inner: string, cls = '') => `<div class="sa hf-sa ${cls}">${inner}</div>`;
function state(view: View, withNew: boolean): State {
  const s = startState(view);
  if (withNew) {
    s.mails = [structuredClone(NEW_MAIL), ...s.mails];
    s.syncedAt = '9:41 AM';
    s.synced = true;
  }
  return s;
}
const SHOT_MAILS = screen(laptop(state('mails', true), null), 'is-mails');
const mailState = state('mail', true);
mailState.mailId = NEW_MAIL.id;
mailState.reply = { text: NEW_MAIL.draft ?? '', writing: false };
const SHOT_MAIL = screen(laptop(mailState, mailState.mails[0]), 'is-mail');
/* Scene 3: the "Recruiter contact" filter is picked; the other rows fold away, Fernhill and Lumen Health stay */
const SHOT_APPS = screen(
  laptop((() => { const st = state('applications', true); const f = st.apps.find((a) => a.co === 'Fernhill'); if (f) { f.status = 'RECRUITER_CONTACT'; f.todo = 'Suggest a time for a call'; f.due = 'By Fri, Nov 7'; f.last = 'Mail from Meera Shah · Just now'; } return st; })(), null)
    .replace('<span class="on">All</span>', '<span class="hf-segall">All</span>')
    .replace('<span>Recruiter contact</span>', '<span class="hf-segrc">Recruiter contact</span>')
    .replace(/<span class="sa-count">\d+<\/span>/, `<span class="sa-count">${'<span class="hf-roll" style="--at:1500ms"><span class="was">6</span><span class="now">2</span></span>'}</span>`)
    .replace(/<div class="sa-tr apps([^"]*)"([^>]*)>(\s*<span class="sa-cell"><span class="sa-subj">(Brightwave|Kestrel Labs|Halcyon|Orbitly)<\/span>)/g, (_, c: string, a: string, rest: string) => `<div class="sa-tr apps${c} hf-fold"${a}>${rest}`)
    .replace(/<div class="sa-tr apps([^"]*)"([^>]*)>(\s*<span class="sa-cell"><span class="sa-subj">Fernhill<\/span>)/, (_, c: string, a: string, rest: string) => `<div class="sa-tr apps${c} hf-fern"${a}>${rest}`),
  'is-apps',
);
/** A number that rolls from its old value to its new one at `at` ms into the shot. */
const roll = (was: number, now: number, at: number) => `<span class="hf-roll" style="--at:${at}ms"><span class="was">${was}</span><span class="now">${now}</span></span>`;
/*
 * Scene 4 (owner, 20 Nov 2026: "just show graph and charts UI, with subtle animations"; no tooltip): the
 * charts as they are, history and all; the camera drifts down over them. Only today's change moves: each
 * line takes its last step, its end mark (the app's dot and value at the end of each line) pulses once,
 * and Replies goes from 6 to 7.
 */
const END_MARKS = (() => {
  const marks: [number, number | string][] = [[12, 12], [7, roll(6, 7, 2200)], [2, 2]];
  return `<div class="hf-ends" aria-hidden="true">${marks
    .map(([p, label], j) => `<span class="hf-end c${j + 1}" style="top:${(100 - (p / 12) * 96).toFixed(1)}%"><i></i><em>${label}</em></span>`)
    .join('')}</div>`;
})();
const SHOT_DASH = screen(
  laptop(state('dashboard', true), null)
    .replace(/(Replies received<\/span><span class="v">)(\d+)(<\/span>)/, (_, a: string, n: string, b: string) => `${a}${roll(Number(n) - 1, Number(n), 2200)}${b}`)
    .replace(/<div><b>(\d+)<\/b><i([^>]*)><\/i><span>Got a reply<\/span><\/div>/, (_, n: string, i: string) => `<div class="hf-reply-bar"><b>${roll(Number(n) - 1, Number(n), 2400)}</b><i${i}></i><span>Got a reply</span></div>`)
    .replace('<svg class="sa-line"', '<div class="hf-plot"><svg class="sa-line"')
    .replace(/(<svg class="sa-line"[\s\S]*?<\/svg>)/, `$1${END_MARKS}</div>`)
    .replace(/<i class="(top)?" style="height:/g, (() => { let i = 0; return (_m: string, top?: string) => `<i class="${top ?? ''}" style="--i:${i++ % 12};height:`; })()),
  'is-dash',
);
const PICTURES: Record<string, string> = { mails: SHOT_MAILS, mail: SHOT_MAIL, apps: SHOT_APPS, dash: SHOT_DASH };

/* The board's other screens: the app around the story, quieter */
const kestrel = state('mail', false);
kestrel.mailId = 'kestrel';
const AROUND = [
  screen(laptop(state('dashboard', false), null)),
  '',
  screen(laptop(state('applications', false), null)),
  screen(laptop(kestrel, kestrel.mails.find((m) => m.id === 'kestrel') ?? null)),
  '',
  screen(laptop(state('mails', false), null)),
];
function board(id: string): string {
  const slot = AIMS[id].slot;
  const cells = AROUND.map((pic, i) => {
    if (i === slot) return `<div class="hf-cell story">${PICTURES[id]}</div>`;
    return `<div class="hf-cell">${pic || screen(laptop(state('applications', false), null))}</div>`;
  });
  return `<div class="hf-board">${cells.join('')}</div>`;
}
/* A scene is an empty shell first; its picture is drawn only when it is needed (see `fill`). */
/** A shot's picture: one sharp copy through its camera (drift, lens, tilt, plane), then the blur veil. */
const draw = (id: string) =>
  `<div class="hf-copy"><div class="hf-move"><div class="hf-lens"><div class="hf-tilt"><div class="hf-plane">${board(id)}</div></div></div></div></div><div class="hf-veil"></div>`;

/** Home's hero film: four shots of 4 s; reduced motion holds the end of the story (15 s). */
export function startFilm(): void {
  runFilm({ prefix: 'hf', shots: ['mails', 'mail', 'apps', 'dash'], cams: CAMS, draw, rest: 15_000 });
}
