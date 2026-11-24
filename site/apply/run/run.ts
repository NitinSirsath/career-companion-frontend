/*
 * "Today's run", northlist.site/apply/run (owner, 23 Nov 2026). The user's AI opens it at the end of a run,
 * and at `start` when questions are still open (instructions/run_page.md in NorthList Apply). The questions
 * waiting for the user come first, then today's report, then NorthList. The page sends nothing anywhere:
 * the facts arrive after "#", the answers stay in this browser, and the AI reads them back from the page
 * text once the title starts with "Done". Dark by default, with a light/dark switch.
 */
import { esc } from '../setup/data.ts';
import { icon } from '../setup/views.ts';
import { fitScene, rings } from '../setup/stage.ts';
import { SAMPLE, answersBlock, jobsOf, newAnswer, readRun, storageKey, type Answer, type Run } from './data.ts';
import { appliedRows, dayName, northlistCard, questions, report, scene } from './views.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
const THEME_KEY = 'nl-apply-theme';
const params = new URLSearchParams(location.search);
const page = $<HTMLFormElement>('#page') as HTMLFormElement;

let run: Run | null = null;
let answers: Record<string, Answer> = {};
let done = false;

const answered = () => (run ? run.waiting.filter((w) => answers[w.id].value.trim() !== '').length : 0);
const saveLabel = () => {
  const n = answered();
  const all = run?.waiting.length ?? 0;
  return n === all ? 'Save answers' : `Save ${n} of ${all}`;
};

/* ── Kept in this browser, so a closed page keeps its answers ── */
function load(r: Run) {
  answers = Object.fromEntries(r.waiting.map((w) => [w.id, newAnswer(w)]));
  done = false;
  try {
    const kept = JSON.parse(localStorage.getItem(storageKey(r)) ?? 'null') as { answers?: Record<string, Answer>; done?: boolean } | null;
    for (const [id, a] of Object.entries(kept?.answers ?? {})) if (answers[id]) answers[id] = { value: String(a.value ?? ''), every: a.every !== false };
    done = kept?.done === true;
  } catch {
    /* nothing kept */
  }
}
function keep() {
  if (!run?.waiting.length) return;
  try {
    localStorage.setItem(storageKey(run), JSON.stringify({ answers, done }));
  } catch {
    /* not kept */
  }
}

/* ── The page ───────────────────────────────────────── */
function heading(r: Run): [string, string] {
  const jobs = jobsOf(r.waiting).length;
  const name = r.firstName ? `${r.firstName}, ` : '';
  if (done) return ['Saved. Your AI is on it.', 'Go back to your AI chat. It saves your answers and applies to those jobs again.'];
  if (r.mode === 'questions')
    return [`${jobs} ${jobs === 1 ? 'job' : 'jobs'} from your last run ${jobs === 1 ? 'needs' : 'need'} an answer`, 'Answer them, and your AI applies to those jobs before today’s plan.'];
  if (jobs) return [`${name}${jobs} ${jobs === 1 ? 'job needs' : 'jobs need'} your answers`, 'Answer these, and your AI applies to them again. Below is everything else it did today.'];
  return [`Today's run${r.firstName ? `, ${r.firstName}` : ''}`, 'Everything your AI did today, in one place.'];
}

function doneBlock(r: Run): string {
  return `<section class="section"><p class="saved-note"><span class="dot live"></span><span class="shimmer">Your AI is saving your answers…</span></p>
    <div class="for-ai"><p>For your AI · Nothing after a minute? Type <b>done</b> in the chat.</p><pre id="northlist-answers">${esc(answersBlock(r.waiting, answers))}</pre></div></section>`;
}

function emptyPage() {
  page.innerHTML = `<div class="run-main"><h1>Today's run</h1><p class="sub">Your AI opens this page at the end of each run, with what it did and any questions for you. Type <b>start</b> in your AI app to run NorthList Apply.</p></div>`;
  document.title = 'Today’s run · NorthList Apply';
}

function render() {
  if (!run) return emptyPage();
  const r = run;
  const [title, sub] = heading(r);
  const open = r.waiting.length > 0 && !done;
  const qs = open ? questions(r, answers, answered()) : '';
  const rest = r.mode === 'questions' ? '' : report(r) + northlistCard(r);
  const foot = open
    ? `<div class="footer"><span class="kbd">Skip any you are not sure about</span><div class="right"><button type="submit" class="btn btn-primary" id="save"${answered() ? '' : ' disabled'}>${saveLabel()}</button></div></div>`
    : '';
  page.innerHTML = `<div class="run-main stagger"><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${done ? doneBlock(r) : ''}${qs}${rest}</div>${foot}`;
  document.title = done ? 'Done · Today’s run · NorthList Apply' : 'Today’s run · NorthList Apply';
  const note = $('#top-note');
  if (note) note.textContent = r.date ? dayName(r.date, { weekday: 'long', day: 'numeric', month: 'short' }) : '';
  countUp();
  requestAnimationFrame(fit);
}

/** Only the parts that change: no card re-renders while the user types. */
function refresh(id: string) {
  if (!run) return;
  $(`#card-${CSS.escape(id)}`)?.classList.toggle('answered', answers[id].value.trim() !== '');
  const count = $('#answered');
  if (count) count.textContent = `${answered()} of ${run.waiting.length} answered`;
  const save = $<HTMLButtonElement>('#save');
  if (save) {
    save.disabled = !answered();
    save.textContent = saveLabel();
  }
  keep();
}

function step(id: string, by: number, button: HTMLElement) {
  const a = answers[id];
  const now = a.value === '' ? 0 : Number(a.value) || 0;
  a.value = String(a.value === '' && by < 0 ? 0 : Math.max(0, Math.min(40, now + by)));
  const out = button.parentElement?.querySelector('output');
  if (out) out.textContent = a.value;
  refresh(id);
}

function wire() {
  page.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    const m = t.name?.match(/^(a|s)-(.+)$/);
    if (!m || !answers[m[2]]) return;
    if (m[1] === 'a') answers[m[2]].value = t.value;
    else answers[m[2]].every = t.value === 'every';
    refresh(m[2]);
  });
  page.addEventListener('input', (e) => {
    const t = e.target as HTMLTextAreaElement;
    const id = t.dataset.q;
    if (!id || !answers[id]) return;
    answers[id].value = t.value;
    refresh(id);
  });
  page.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || !run) return;
    if (b.dataset.n && b.dataset.q) step(b.dataset.q, Number(b.dataset.n), b);
    if (b.id === 'show-all') {
      const list = $('#applied-list');
      if (list) list.innerHTML = appliedRows(run, true);
      b.remove();
    }
  });
  page.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!answered()) return;
    done = true;
    keep();
    render();
    scrollTo(0, 0);
  });
  addEventListener('hashchange', () => start());
  addEventListener('resize', fit);
}

/* ── Picture, numbers, light / dark ─────────────────── */
function drawPicture(r: Run) {
  const pic = $('#picture');
  if (pic) pic.innerHTML = scene(r);
  const caption = $('#stage-caption');
  if (caption) caption.textContent = r.northlist.connected ? 'Your applications in NorthList, live' : 'Connect NorthList to see this for every run';
}
function fit() {
  fitScene();
  // On phones the picture sits inside the NorthList card, scaled to the column
  const box = $('.nl-scene');
  const sc = box?.querySelector<HTMLElement>('.scene');
  if (!box || !sc || !box.clientWidth) return;
  const k = Math.min(1, (box.clientWidth - 24) / 740);
  sc.style.scale = String(k);
  sc.style.left = `${(box.clientWidth - 740 * k) / 2}px`;
  box.style.height = `${Math.round(540 * k + 24)}px`;
}
/** Numbers count up on screen only: a hidden page (or the AI reading it) always gets the real numbers. */
function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible') return;
  const nums = [...document.querySelectorAll<HTMLElement>('[data-count]')];
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    nums.forEach((b) => (b.textContent = b.dataset.count ?? b.textContent));
  };
  document.addEventListener('visibilitychange', finish, { once: true });
  setTimeout(finish, 1200);
  nums.forEach((b) => {
    const end = Number(b.dataset.count);
    const t0 = performance.now() + 150;
    const tick = (now: number) => {
      if (done) return;
      const k = Math.min(1, Math.max(0, (now - t0) / 900));
      b.textContent = String(Math.round(end * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function drawTheme() {
  const light = document.documentElement.dataset.theme === 'light';
  const b = $('#theme');
  if (!b) return;
  b.innerHTML = icon(light ? 'moon' : 'sun');
  b.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
}
function wireTheme() {
  $('#theme')?.addEventListener('click', () => {
    const root = document.documentElement;
    const light = root.dataset.theme !== 'light';
    root.classList.add('theme-swap');
    root.dataset.theme = light ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, light ? 'light' : 'dark');
    } catch {
      /* not remembered */
    }
    drawTheme();
    setTimeout(() => root.classList.remove('theme-swap'), 350);
  });
  drawTheme();
}

/* ── Start ──────────────────────────────────────────── */
function start() {
  run = readRun(location.hash) ?? (params.has('demo') ? structuredClone(SAMPLE) : null);
  if (run && params.get('demo') === 'questions') run.mode = 'questions';
  if (run && params.has('connected')) run.northlist = { connected: true, sent: run.applied.length };
  if (run) {
    load(run);
    drawPicture(run);
  }
  render();
}
const ringsEl = $('#rings');
if (ringsEl) ringsEl.innerHTML = rings();
wire();
wireTheme();
start();
