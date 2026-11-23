/*
 * The setup page's pictures (owner, 23 Nov 2026): on the right of a laptop screen, a resume being read, then
 * a profile card that fills in as the user answers; on the NorthList step, a scene with the applications
 * list, the AI applying now, the numbers and a phone with a reply alert. On phones a strip above the text.
 */
import { NL, YEARS, currentAmount, esc, expectedAmount, permissionLine, totalYears, whereLine, words, type State } from './data.ts';
import { icon, initials } from './views.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let last: Record<string, string> = {};

const noticeText = (S: State) => {
  if (!S.notice) return '';
  return S.notice === '0' ? 'Right away' : `${S.notice} days`;
};
function payText(S: State): string {
  if (S.currentNone) return 'Not shared';
  const cur = currentAmount(S);
  if (!cur) return '';
  const exp = expectedAmount(S);
  return `${words(cur, S.currency, S.period, true)}${exp ? ` → ${words(exp, S.currency, S.period, true)}` : ''}`;
}
function cell(v: string, read: boolean): string {
  if (v) return esc(v);
  return read ? '<span class="muted">—</span>' : '<span class="skel"></span>';
}

function profileCard(S: State, full: boolean): string {
  const R = S.resume;
  const vals: Record<string, string> = {
    Skills: R ? Object.entries(S.skills).slice(0, 4).map(([k, v]) => `${k} ${YEARS[v]}`).join(' · ') : '',
    Notice: noticeText(S),
    Pay: payText(S),
    Where: R ? whereLine(S) : '',
    Permission: R ? permissionLine(S) : '',
    Jobs: S.titles.join(', '),
  };
  const at: Record<string, number> = { Skills: 2, Notice: 3, Pay: 3, Where: 4, Permission: 5, Jobs: 6 };
  const rows = Object.entries(vals)
    .map(([k, v]) => {
      const flash = !full && !last[k] && v ? 'flash' : ''; // only when a row first fills in
      return `<div class="prow ${S.step === at[k] ? 'now' : ''} ${flash}"><dt>${k}</dt><dd>${cell(v, Boolean(R))}</dd></div>`;
    })
    .join('');
  last = vals;
  const head = R
    ? `<b>${esc(R.firstName)} ${esc(R.lastName)}</b><small>${esc(R.currentTitle)} · ${totalYears(S.jobs)}</small>`
    : '<span class="skel w140"></span><br><span class="skel w90"></span>';
  return `<dl class="float pcard ${full ? '' : 'still'}"><div class="me-head"><span class="avatar">${R ? initials(R) : ''}</span><div>${head}</div></div>${rows}</dl>`;
}

function paper(S: State): string {
  const lines = ['h', 's', '', '', '', 'gap', '', '', '', 'gap', '', '', ''];
  const widths = [92, 80, 86, 70, 90, 76, 84];
  const body = lines.map((l, i) => (l === 'gap' ? '<div class="gap"></div>' : `<div class="l ${l}" style="${l ? '' : `width:${widths[i % 7]}%`}"></div>`)).join('');
  const beam = S.file && !S.resume ? '<div class="beam"></div>' : '';
  return `<div class="float paper ${S.resume ? 'read' : ''}">${beam}${body}<span class="badge">${icon('check')}</span></div>${S.file ? '' : '<p class="drop-hint">Your resume stays on this computer</p>'}`;
}

const APPS: [string, string, string, string, string, string, string][] = [
  ['A', 'Acme Cloud', 'Frontend Engineer', 'LinkedIn', 'Interview', 'Thu 11:00', 'sage'],
  ['B', 'Brightpath', 'React Developer', 'Naukri', 'Replied', '2 h ago', 'lilac'],
  ['C', 'Cobalt Labs', 'UI Engineer', 'Workday', 'Applied', 'Today', 'peach'],
  ['D', 'Delta Health', 'Frontend Engineer', 'Indeed', 'Applied', 'Today', 'sand'],
  ['E', 'Echo Pay', 'Senior Frontend', 'company site', 'Applied', 'Yesterday', 'rose'],
];

/** The NorthList scene: what NorthList shows once the user connects it. */
export function scene(): string {
  const rows = APPS.map(
    ([l, c, r, p, s, w, t]) =>
      `<div class="app-row"><span class="logo-tile t-${t}">${l}</span><div><b>${c}</b><span>${r} · via ${p}</span></div><em><strong>${s}</strong>${w}</em></div>`,
  ).join('');
  const phoneRows = APPS.slice(0, 4)
    .map(([l, c, , p, s, , t]) => `<div class="ph-row"><span class="logo-tile t-${t}">${l}</span><div><b>${c}</b><span>${s} · ${p}</span></div></div>`)
    .join('');
  return `<div class="scene">
    <div class="float win">
      <div class="win-bar"><i></i><i></i><i></i><b>NorthList · Applications</b><small>42 this month</small></div>
      <div class="win-body">
        <div class="platforms"><span>LinkedIn</span><span>Naukri</span><span>Indeed</span><span>Workday</span><span>Wellfound</span><span>Company sites</span></div>
        <div>${rows}</div>
      </div>
    </div>
    <div class="float ai-live"><div class="live-top"><span class="pulse"></span>Your AI is applying now</div><p>Cobalt Labs · UI Engineer · Workday form, step 3 of 5</p><div class="bar"><i></i></div></div>
    <div class="float stats"><div><b data-count="42">42</b><span>Applied</span></div><div><b data-count="6">6</b><span>Replies</span></div><div><b data-count="2">2</b><span>Interviews</span></div></div>
    <div class="phone"><div class="phone-screen">
      <div class="notif"><b>${icon('bell')} NorthList</b><span>Brightpath replied: "Can we talk Thursday?"</span></div>
      <h3>Applications</h3>${phoneRows}
    </div></div>
  </div>`;
}

/** The scene keeps its size and scales down to fit the right side. */
export function fitScene() {
  const sc = $('#picture .scene');
  const st = $('.stage');
  if (!sc || !st?.clientWidth) return;
  sc.style.scale = String(Math.min(1, (st.clientWidth - 64) / 740, (st.clientHeight - 64) / 540));
}

/** In one-column layouts the scene sits above the text, scaled to the column. */
export function fitStrip() {
  const st = $('#strip');
  const sc = st?.querySelector<HTMLElement>('.scene');
  if (!st || !sc || !st.clientWidth) return;
  const k = Math.min(1, (st.clientWidth - 24) / 740);
  sc.style.scale = String(k);
  sc.style.left = `${(st.clientWidth - 740 * k) / 2}px`;
  st.style.height = `${Math.round(540 * k + 24)}px`;
}

/** Numbers count up when the scene appears. */
function countUp() {
  if (reduced()) return;
  document.querySelectorAll<HTMLElement>('#picture [data-count]').forEach((b) => {
    const end = Number(b.dataset.count);
    const t0 = performance.now() + 600;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 900));
      b.textContent = String(Math.round(end * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** The resume picture changes in place, so it does not jump in again. */
function updatePaper(S: State, pic: HTMLElement, full: boolean) {
  const el = pic.querySelector('.paper');
  if (!el) {
    if (full) pic.innerHTML = paper(S);
    return;
  }
  el.classList.toggle('read', Boolean(S.resume));
  if (S.resume || !S.file) el.querySelector('.beam')?.remove();
  else if (!el.querySelector('.beam')) el.insertAdjacentHTML('afterbegin', '<div class="beam"></div>');
  pic.querySelector('.drop-hint')?.remove();
}

/** Redraw the picture on the right; `full` when the step changed (entrance motion), not on every answer. */
export function drawPicture(S: State, full: boolean) {
  const pic = $('#picture');
  if (!pic) return;
  if (S.step === NL) {
    if (full) {
      pic.innerHTML = scene();
      fitScene();
      countUp();
    }
    return;
  }
  if (S.step === 0) return updatePaper(S, pic, full);
  pic.innerHTML = profileCard(S, full);
}

/** The strip above the text on phones and narrow windows. */
export function drawStrip(S: State) {
  const st = $('#strip');
  if (!st) return;
  st.className = 'strip';
  st.style.height = '';
  if (S.step === NL) {
    st.classList.add('scene-strip');
    st.innerHTML = scene();
    fitStrip();
    return;
  }
  const R = S.resume;
  st.innerHTML = R
    ? `<span class="avatar">${initials(R)}</span><span><b>${esc(R.firstName)}</b> · ${esc(R.currentTitle)}</span>`
    : '<span class="muted">Your answers fill in as you go</span>';
}

/** The faint rings behind the pictures. */
export const rings = () =>
  Array.from({ length: 13 }, (_, i) => `<circle cx="50%" cy="50%" r="${60 + i * 70}" fill="none" stroke="var(--art)" stroke-opacity=".06"/>`).join('');
