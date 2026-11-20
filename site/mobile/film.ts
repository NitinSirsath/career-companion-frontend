import { appIcon as I } from '../parts/appIcons.ts';
import { mark } from '../parts/icons.ts';
import { cameras, startFilm as runFilm, type Angle, type ShotAim } from '../runtime/film.ts';

/*
 * The Mobile hero's film (owner, 20 Nov 2026), after stockypro.com's paid-app hero (FilmHero,
 * film-camera.ts, the Leads film): the phone app behind the words, in four shots of 4 s with hard cuts,
 * a 16 s loop. One story, all in the app today:
 *   1. 0–4 s   the alert lands on the lock screen: "Brightwave: Choose an interview time";
 *   2. 4–8 s   Mails: Priya Nair's mail pushes in on top with its next step;
 *   3. 8–12 s  the mail: Reply opens, a reply choice is picked and the AI's draft fills in;
 *   4. 12–16 s sent: the step turns Replied, then Done (the only green), the status moves to Interview;
 *              the camera rises and pulls back slowly and the story fades out, a calm finish before it loops.
 * Each shot has its own camera angle and its own motion (push in, pan, orbit, pull back), and its phone
 * sits among the app's other screens, so the frame is never empty. What lands in a shot moves in CSS
 * (`.mb-scene[data-on]`), so the story only changes at the cuts. The camera, blur, clock and pause are the
 * shared film's (site/runtime/film.ts).
 */

/*
 * The board: the story's phone among the app's other screens, 4 across and 3 down, so the frame is never
 * empty around it. Each shot puts its phone in a slot and aims there; the neighbours fall into the blur.
 */
const PH_W = 422;
const PH_H = 894;
const GAP = 72;
const COLS = 4;
const slotAt = (slot: number) => ({ x: (slot % COLS) * (PH_W + GAP), y: Math.floor(slot / COLS) * (PH_H + GAP) });

/*
 * Four angles, one per shot (owner, 20 Nov 2026: "not a single angle"). Two come from stockypro.com's
 * calibrated cameras (Desk's board, Leads), two are their mirror and a low, flatter view.
 */
const ANGLES: Record<string, Angle> = {
  // Desk's board camera: leaning back, turned right.
  alert: { rx: 51.953, ry: -27.483, rz: 41.371, persp: 6483.6, pox: 691.3, poy: 1067.8, sx: 1019.6, sy: 301.2, mcx: 1019.6, mcy: 301.2, mrx: 760, mry: 240, mturn: -40 },
  // Leads' camera: leaning back, turned left.
  inbox: { rx: 49.314, ry: 22.819, rz: -28.077, persp: 5260.7, pox: 1467.8, poy: 676.4, sx: 690, sy: 250, mcx: 720, mcy: 290, mrx: 760, mry: 230, mturn: 3 },
  // Low and flatter, nearly facing the camera.
  mail: { rx: 26, ry: -8, rz: 10, persp: 2600, pox: 720, poy: 1000, sx: 760, sy: 270, mcx: 760, mcy: 290, mrx: 660, mry: 270, mturn: -8 },
  // Leads' mirrored: leaning back, turned right, seen from the left.
  done: { rx: 44, ry: -20, rz: 24, persp: 4800, pox: 200, poy: 700, sx: 780, sy: 250, mcx: 780, mcy: 270, mrx: 720, mry: 240, mturn: -22 },
};
/** Each shot: its phone's slot, the point in that phone to aim at (its own px) and the zoom; on phones, their own aim. */
const AIMS: Record<string, ShotAim> = {
  alert: { slot: 5, x: 211, y: 520, cs: 1.4, px: 211, py: 520, pcs: 1.1 },
  inbox: { slot: 6, x: 190, y: 250, cs: 1.7, px: 200, py: 260, pcs: 1.25 },
  mail: { slot: 5, x: 200, y: 520, cs: 1.45, px: 200, py: 520, pcs: 1.15 },
  done: { slot: 6, x: 200, y: 330, cs: 1.7, px: 200, py: 320, pcs: 1.25 },
};
const CAMS = cameras(ANGLES, AIMS, slotAt);
/* ---------- The pictures: the phone app's own screens, drawn flat ---------- */
const STATUS =
  '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect y="7.5" width="3" height="4.5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" width="3" height="12" rx="1"/></svg>' +
  '<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1.6 4.6a9 9 0 0 1 12.8 0"/><path d="M4.4 7.4a5 5 0 0 1 7.2 0"/><circle cx="8" cy="10.2" r="1.3" fill="currentColor" stroke="none"/></svg>' +
  '<svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/></svg>';
const phone = (time: string, inner: string, cls = '') =>
  `<div class="mb-ph"><div class="mb-scr ${cls}"><div class="mb-sb"><span>${time}</span><span class="i">${STATUS}</span></div><span class="mb-island"></span>${inner}<span class="mb-homebar"></span></div></div>`;
const ring = (part: 'third' | 'half') =>
  `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="${part === 'third' ? 'M7 7V1.5A5.5 5.5 0 0 1 12.5 7Z' : 'M7 7V1.5A5.5 5.5 0 0 1 7 12.5Z'}" fill="currentColor"/></svg>`;
const glass = (ic: string) => `<span class="mb-gb">${I(ic, 22)}</span>`;

/* Shot 1: an iPhone lock screen as it really looks: lock, date, the big time, widgets, a notification
   stack (Gmail's mail first, then NorthList's alert lands on top), flashlight and camera. */
const ICON = {
  lock: '<svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="8" width="12" height="9" rx="2.5" fill="currentColor" stroke="none"/><path d="M3.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>',
  sun: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  torch: '<svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M8 2h8v4l-2 4v12h-4V10L8 6z"/><path d="M12 13v3"/></svg>',
  cam: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 8h3.5l2-3h7l2 3H21v11H3z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  mail: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/></svg>',
};
type Notice = { cls: string; icon: string; app: string; when: string; title: string; body: string };
const notif = ({ cls, icon, app, when, title, body }: Notice) =>
  `<div class="l-n ${cls}"><span class="ic">${icon}</span><div class="tx"><p class="h"><b>${title}</b><span>${when}</span></p><p class="b">${body}</p><p class="a">${app}</p></div></div>`;
const SHOT_ALERT = phone(
  '',
  `<span class="l-wall"></span>
   <span class="l-lock">${ICON.lock}</span>
   <p class="l-date">Monday, November 3</p>
   <p class="l-time">9:14</p>
   <div class="l-widgets">
     <span class="w-rect"><span class="w-ic">${ICON.sun}</span><span><b>Sunny</b><em>H:21° L:12°</em></span></span>
     <span class="w-ring" style="--p:86"><b>86</b><em>%</em></span>
     <span class="w-ring" style="--p:62"><b>18°</b></span>
   </div>
   <div class="l-stack">
     ${notif({ cls: 'new', icon: mark(22), app: 'NorthList', when: 'now', title: 'Brightwave', body: 'Choose an interview time. Due Mon, Nov 3.' })}
     ${notif({ cls: 'old', icon: ICON.mail, app: 'Gmail', when: '9:12 AM', title: 'Priya Nair', body: 'Interview invitation: Frontend Engineer' })}
     <span class="l-more"></span><span class="l-more two"></span>
   </div>
   <div class="l-btns"><span>${ICON.torch}</span><span>${ICON.cam}</span></div>`,
  'lock',
);

type MailRow = { from: string; when: string; subject: string; step: string; tag: string; cls?: string };
const row = ({ from, when, subject, step, tag, cls = '' }: MailRow) =>
  `<div class="m-row ${cls}"><i class="dot"></i><div class="c"><p class="t"><b>${from}</b><span>${when} ${I('chevronRight', 14)}</span></p><p class="s">${subject}</p><p class="st">${I('arrowRight', 14)} ${step}</p><p class="tg">${tag}</p></div></div>`;
const SHOT_INBOX = phone(
  '9:14',
  `<div class="m-top"><span class="mb-cap3">${I('renew', 22)}${I('search', 22)}${I('filter', 22)}</span></div>
   <h3 class="m-big">Job mails ${I('chevronDown', 22)}</h3><p class="m-sync">Synced 9:14 AM · 1 new mail</p>
   <div class="m-rows">
     ${row({ from: 'Priya Nair', when: 'Today, 9:12 AM', subject: 'Interview invitation: Frontend Engineer', step: 'Choose an interview time', tag: '<span class="pill">Recruiter contact</span> Brightwave · Due Mon, Nov 3', cls: 'new' })}
     <div class="push">
       ${row({ from: 'Kestrel Hiring', when: 'Yesterday', subject: 'Your take-home test', step: 'Finish the coding test', tag: '<span class="pill">Assessment</span> Kestrel Labs · Due Thu, Nov 6', cls: 'seen' })}
       ${row({ from: 'Daniel Ortiz', when: 'Oct 28', subject: 'Quick chat about a React role?', step: 'Send your notice period', tag: '<span class="pill">Recruiter contact</span> Lumen Health · You replied', cls: 'seen' })}
       ${row({ from: 'Orbitly Careers', when: 'Oct 27', subject: 'Update on your application', step: 'Nothing needed from you', tag: '<span class="pill">Applied</span> Orbitly', cls: 'seen' })}
     </div>
   </div>
   <div class="mb-tabs"><span>${I('dashboard', 22)}</span><span class="on">${I('mail', 22)}</span><span>${I('doc', 22)}</span><span>${I('settings', 22)}</span></div>`,
);

const mailTop = (status: string) =>
  `<div class="m-top two">${glass('chevronLeft')}${glass('info')}</div>
   <h3 class="d-title">Interview invitation: Frontend Engineer</h3>
   <p class="d-meta">${I('building', 16)} Brightwave ${I('briefcase', 16)} Frontend Engineer</p>
   <p class="d-pills">${status}</p>`;
const SHOT_MAIL = phone(
  '9:58',
  `${mailTop(`<span class="pill">${ring('third')} Recruiter contact</span>`)}
   <div class="d-step"><span class="o">Next step</span><b>Choose an interview time</b><span class="due">Due Mon, Nov 3 · <em>Needs action</em></span></div>
   <div class="mb-scrim"></div>
   <div class="r-sheet"><span class="grab"></span>
     <div class="r-head"><span class="x">${I('close', 20)}</span><b>Reply</b><span class="send">Send</span></div>
     <p class="r-to">To <b>Priya Nair</b></p>
     <p class="r-ai">${I('ai', 16)} Reply with AI</p>
     <div class="r-chips"><span class="chip pick">Take Tue, Nov 4, 11:00 AM</span><span class="chip">Ask for another time</span></div>
     <div class="r-text"><p class="ty" style="--n:0">Hi Priya,</p><p class="ty" style="--n:1">Thank you for the invitation. Tuesday,</p><p class="ty" style="--n:2">November 4 at 11:00 AM works well for me.</p><p class="ty" style="--n:3">I look forward to meeting the team.</p><p class="ty" style="--n:4">Best regards, Alex</p></div>
   </div>`,
);

const SHOT_DONE = phone(
  '10:05',
  `<div class="toast">${I('check', 16)} Sent from your Gmail</div>
   ${mailTop(`<span class="pill swap"><span class="was">${ring('third')} Recruiter contact</span><span class="now">${ring('half')} Interview</span></span>`)}
   <div class="d-step"><span class="o">Next step</span><b>Choose an interview time</b>
     <span class="state"><span class="was">${I('reply', 14)} Replied</span><span class="now ok">${I('checkCircle', 16)} Done</span></span></div>
   <p class="d-h">Activity</p>
   <ul class="d-act"><li><i></i>You replied <span>10:03</span></li><li class="late"><i></i>AI read your reply: it answers the step <span>10:05</span></li><li class="late"><i></i>Status moved to Interview <span>10:05</span></li></ul>`,
);


/* ---------- The board's other screens: the app around the story, quieter ---------- */
const BG_DASH = phone(
  '9:41',
  `<div class="m-top">${glass('renew')}</div><h3 class="m-big">Dashboard</h3><p class="m-sync">Good morning, Alex · Monday, November 3</p>
   <p class="b-h">Needs you now</p>
   <div class="b-tile"><span>${I('mail', 16)} New job mails</span><b>2</b></div>
   <div class="b-tile"><span>${I('todo', 16)} Needs action</span><b>3</b></div>
   <div class="b-tile dim"><span>${I('calendar', 16)} Interviews coming up</span><b>0</b></div>
   <p class="b-h">Your progress</p><div class="b-bars"><i style="--h:40%"></i><i style="--h:65%"></i><i style="--h:30%"></i><i style="--h:80%"></i><i style="--h:55%"></i><i style="--h:70%"></i></div>`,
);
const appRow = (co: string, job: string, status: string) =>
  `<div class="b-app"><p><b>${co}</b><span class="pill">${status}</span></p><p class="j">${job}</p></div>`;
const BG_APPS = phone(
  '9:41',
  `<div class="m-top"><span class="mb-cap3">${I('renew', 22)}${I('search', 22)}${I('filter', 22)}</span></div><h3 class="m-big">Applications</h3>
   <p class="b-seg"><span class="on">In progress 6</span><span>NorthList Apply</span></p>
   ${appRow('Brightwave', 'Frontend Engineer', 'Interview')}${appRow('Kestrel Labs', 'React Developer', 'Assessment')}${appRow('Lumen Health', 'Frontend Developer', 'Recruiter contact')}${appRow('Halcyon', 'UI Engineer', 'Applied')}${appRow('Orbitly', 'Web Developer', 'Applied')}`,
);
const setRow = (k: string, v: string) => `<div class="b-set"><span>${k}</span><em>${v}</em>${I('chevronRight', 16)}</div>`;
const BG_SETTINGS = phone(
  '9:41',
  `<div class="m-top"></div><h3 class="m-big">Settings</h3><p class="b-h">Set up</p>
   <div class="b-group">${setRow('Gmail sync', '9:40 AM')}${setRow('AI providers', 'OpenRouter')}${setRow('NorthList Apply', 'Not connected')}</div>
   <p class="b-h">This phone</p><div class="b-group">${setRow('Appearance', 'Dark')}${setRow('Alerts on this phone', 'On')}${setRow('Install app', 'Home Screen')}</div>`,
);
const BG_KESTREL = phone(
  '9:41',
  `<div class="m-top two">${glass('chevronLeft')}${glass('info')}</div><h3 class="d-title">Your take-home test</h3>
   <p class="d-meta">${I('building', 16)} Kestrel Labs ${I('briefcase', 16)} React Developer</p><p class="d-pills"><span class="pill">Assessment</span></p>
   <div class="d-step"><span class="o">Next step</span><b>Finish the coding test</b><span class="due">Due Thu, Nov 6</span></div>
   <p class="d-h">Activity</p><ul class="d-act"><li><i></i>Mail from Kestrel Hiring arrived <span>4:30</span></li><li><i></i>Found one ask: finish the coding test <span>4:31</span></li></ul>`,
);

const PICTURES: Record<string, string> = { alert: SHOT_ALERT, inbox: SHOT_INBOX, mail: SHOT_MAIL, done: SHOT_DONE };

/** The other screens, in board order; the story's phone takes its shot's slot. */
const AROUND = [BG_DASH, BG_APPS, BG_SETTINGS, BG_KESTREL, BG_APPS, '', '', BG_DASH, BG_SETTINGS, BG_KESTREL, BG_DASH, BG_APPS];
const MAILS_STILL = SHOT_INBOX.replace('m-row new', 'm-row seen');
function board(id: string): string {
  const slot = AIMS[id].slot;
  const cells = AROUND.map((pic, i) => {
    if (i === slot) return `<div class="b-cell story">${PICTURES[id]}</div>`;
    return `<div class="b-cell">${pic || MAILS_STILL}</div>`;
  });
  return `<div class="mb-board">${cells.join('')}</div>`;
}

/* A scene is an empty shell first; its picture is drawn only when it is needed (see `fill`). */
/* The tilt (a lean over the aim) and the orbit (a turn around it) are plain transforms on their own layers, so the graphics chip moves them without redrawing the plane (performance, 20 Nov 2026). */
const draw = (id: string) =>
  `<div class="mb-copy"><div class="mb-move"><div class="mb-lens"><div class="mb-tilt"><div class="mb-plane"><div class="mb-orb">${board(id)}</div></div></div></div></div></div><div class="mb-veil"></div>`;

/** The Mobile hero's film: four shots of 4 s; reduced motion holds the end of the story (15 s). */
export function startFilm(): void {
  runFilm({ prefix: 'mb', shots: ['alert', 'inbox', 'mail', 'done'], cams: CAMS, draw, rest: 15_000 });
}
