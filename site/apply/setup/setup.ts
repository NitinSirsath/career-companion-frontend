/*
 * NorthList Apply setup page, northlist.site/apply/setup (owner, 23 Nov 2026). The user's AI opens it from
 * NorthList Apply (instructions/setup_page.md): the resume first, then 8 short screens, then Done. The page
 * sends nothing anywhere: the resume facts arrive after "#", the answers stay in this browser until Done,
 * and the AI reads them back from the page text. Dark by default, with a light/dark switch.
 */
import {
  DONE,
  NL,
  STEPS,
  applyResume,
  badDates,
  currentAmount,
  esc,
  newState,
  num,
  readFacts,
  totalYears,
  words,
  yrs,
  type FileInfo,
  type Resume,
  type State,
} from './data.ts';
import { drawPicture, drawStrip, fitScene, fitStrip, rings } from './stage.ts';
import { NL_SETUP, expectedHTML, icon, view, type View } from './views.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const KEY = 'nl-apply-setup';
const THEME_KEY = 'nl-apply-theme';
const S: State = newState();
const form = $<HTMLFormElement>('#step');
let current: View;

const SAMPLE: Resume = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha.rao@example.com',
  phoneCountryCode: '+91',
  phoneNumber: '98200 12345',
  city: 'Pune',
  country: 'India',
  currentTitle: 'Frontend Engineer',
  skillYears: { React: 5, TypeScript: 4, 'Next.js': 3, 'Node.js': 2 },
  employers: [
    { company: 'Acme Software', title: 'Frontend Engineer', start: '2022-04', end: 'Present' },
    { company: 'Bluebird Labs', title: 'Junior Developer', start: '2020-07', end: '2022-03' },
  ],
  education: [{ degree: 'B.E.', field: 'Computer Engineering', institution: 'Pune University', year: 2020 }],
  currency: 'INR',
  suggestedTitles: ['Frontend Engineer', 'React Developer', 'Senior Frontend Engineer', 'UI Engineer'],
  checkedTitles: ['Frontend Engineer', 'React Developer'],
  suggestedLocations: ['Pune', 'Bengaluru', 'Mumbai', 'Hyderabad'],
  checkedLocations: ['Pune'],
  englishGuess: 'Professional',
};

/* ── Keeping the answers until Done ─────────────────── */
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* private window: the answers just are not kept */
  }
}
function forget() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}
/** Answers given earlier on this computer; a different resume starts fresh. */
function restore(R: Resume | null): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null;
    if (!saved?.resume || (R?.email && saved.resume.email !== R.email)) return false;
    Object.assign(S, saved);
    return true;
  } catch {
    return false;
  }
}

/* ── Drawing ────────────────────────────────────────── */
function footer(v: View): string {
  if (v.done) return '';
  const back = S.step > 0 ? '<button type="button" class="btn btn-ghost" id="back">Back</button>' : '<span class="kbd">Press <b>Enter</b> to continue</span>';
  const skip = v.skip ? '<button type="button" class="btn btn-plain" id="skip">Not now</button>' : '';
  return `<div class="footer">${back}<div class="right">${skip}<button type="submit" class="btn btn-primary" ${v.blocked ? 'disabled' : ''}>${esc(v.cta ?? 'Continue')}</button></div></div>`;
}

const barClass = (i: number) => {
  if (S.step > i) return 'done';
  return S.step === i ? 'now' : '';
};
/** The AI waits for this title: "Resume added" tells it to look for the dropped file, "Done" to read the answers. */
function pageTitle(v: View): string {
  if (v.done) return 'Done · NorthList Apply setup';
  return S.file && !S.resume ? 'Resume added · NorthList Apply setup' : 'NorthList Apply setup';
}

function render() {
  current = view(S, DEMO);
  const progress = $('#progress');
  if (progress) {
    progress.innerHTML = STEPS.slice(0, DONE)
      .map((_, i) => `<i class="${barClass(i)}"></i>`)
      .join('');
    progress.setAttribute('aria-label', `Step ${Math.min(S.step + 1, DONE)} of ${DONE}`);
  }
  const note = $('#top-note');
  if (note) note.textContent = S.step === DONE ? 'Done' : `About ${Math.max(1, Math.ceil((DONE - S.step) * 0.4))} min left`;
  if (form)
    form.innerHTML = `${S.step < DONE ? `<p class="kicker">Step ${S.step + 1} of ${DONE} · ${STEPS[S.step]}</p>` : ''}
      <h1>${esc(current.title)}</h1><p class="sub">${esc(current.sub)}</p>
      <div class="content">${current.body}</div><p class="error" id="err" role="alert"></p>${footer(current)}`;
  document.title = pageTitle(current);
  drawPicture(S, true);
  drawStrip(S);
  save();
}

/** After an answer: only the button and the picture change, so nothing jumps. */
function refresh() {
  current = view(S, DEMO);
  const b = form?.querySelector<HTMLButtonElement>('.btn-primary');
  if (b) {
    b.disabled = Boolean(current.blocked);
    b.textContent = current.cta ?? 'Continue';
  }
  drawPicture(S, false);
  save();
}

function go(to: number) {
  let next = Math.max(0, Math.min(DONE, to));
  if (next === NL && S.northlist === 'connected') next = next > S.step ? DONE : NL - 1; // already connected: no pitch
  if (next === S.step) return;
  const forward = next > S.step;
  const update = () => {
    S.step = next;
    render();
  };
  scrollTo(0, 0);
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  try {
    document.startViewTransition({ update, types: [forward ? 'forward' : 'backward'] });
  } catch {
    document.startViewTransition(update);
  }
}

/* ── Answers ────────────────────────────────────────── */
function takeFile(f: { name: string; size: number; type?: string }) {
  if (!/pdf$/i.test(f.type ?? '') && !/\.pdf$/i.test(f.name)) {
    const err = $('#err');
    if (err) err.textContent = 'Please add a PDF file.';
    return;
  }
  S.file = { name: f.name, size: f.size };
  render();
}

function addItem(kind: string) {
  const box = $<HTMLInputElement>(`#add-${kind}`);
  const v = box?.value.trim();
  if (!v) return;
  if (kind === 'location') {
    if (!S.locations.includes(v)) S.locations.push(v);
    if (S.resume) S.resume.suggestedLocations = [...new Set([...(S.resume.suggestedLocations ?? []), v])];
  } else if (kind === 'title') {
    if (!S.titles.includes(v)) S.titles.push(v);
    if (!S.extraTitles.includes(v)) S.extraTitles.push(v);
  } else if (!S.skipOthers.includes(v)) S.skipOthers.push(v);
  render();
  $(`#add-${kind}`)?.focus();
}

/** Typing the salary only updates the numbers; the raise cards are rebuilt only when they appear or go. */
function moneyUpdate() {
  const n = currentAmount(S);
  const out = $('#current-words');
  if (out) out.textContent = n ? words(n, S.currency, S.period) : '';
  const box = $('#expected-box');
  if (!box) return;
  const cards = box.querySelectorAll<HTMLElement>('.card');
  if (n && cards.length) {
    cards.forEach((c) => {
      const raise = Number(c.querySelector('input')?.value);
      const small = c.querySelector('small');
      if (small) small.textContent = words(Math.round(n * (1 + raise / 100)), S.currency, S.period, true);
    });
  } else if (Boolean(n) !== Boolean(cards.length)) box.innerHTML = expectedHTML(S);
}

const checkedValues = (name: string) => [...(form?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`) ?? [])].map((x) => x.value);

function onJobDate(t: HTMLInputElement) {
  const j = S.jobs[Number(t.dataset.job)];
  const today = new Date();
  const part = t.dataset.part;
  if (part === 'now') {
    j.end = t.checked ? null : { y: today.getFullYear(), m: today.getMonth() };
    return render();
  }
  const value = Number(t.value);
  if (part === 'sm' || part === 'sy') {
    j.start = part === 'sm' ? { ...j.start, m: value } : { ...j.start, y: value };
    j.check = false;
  } else if (j.end) j.end = part === 'em' ? { ...j.end, m: value } : { ...j.end, y: value };
  const total = $('#total-years');
  if (total) total.textContent = totalYears(S.jobs);
  const err = $('#err');
  if (err) err.textContent = badDates(S.jobs) ? 'A job ends before it starts. Check the dates.' : '';
  refresh();
}

/** One change listener for every question; true when it already redrew the step. */
function onChoice(t: HTMLInputElement): boolean {
  const byName: Record<string, () => void> = {
    notice: () => (S.notice = t.value),
    period: () => {
      S.period = t.value === 'monthly' ? 'monthly' : 'annual';
      moneyUpdate();
    },
    expected: () => {
      S.expected = t.value;
      S.expectedTouched = true;
      const other = $('#other-box');
      if (other) other.hidden = S.expected !== 'other';
      if (S.expected === 'other') $('#expected-other')?.focus();
    },
    mode: () => (S.modes = checkedValues('mode')),
    location: () => (S.locations = checkedValues('location')),
    title: () => (S.titles = checkedValues('title')),
    skipOther: () => (S.skipOthers = checkedValues('skipOther')),
    english: () => (S.english = t.value),
    unlisted: () => (S.unlisted = t.value),
  };
  const byId: Record<string, () => void> = {
    currency: () => {
      S.currency = t.value;
      moneyUpdate();
    },
    relocate: () => (S.relocate = t.checked),
    'skip-current': () => (S.skipCurrent = t.checked),
  };
  if (t.name === 'currentNone') {
    S.currentNone = t.checked;
    render();
    return true;
  }
  if (t.name.startsWith('country-')) S.countries[Number(t.name.slice(8))].value = t.value as State['countries'][number]['value'];
  else (byName[t.name] ?? byId[t.id])?.();
  return false;
}

function onChange(e: Event) {
  const t = e.target as HTMLInputElement;
  if (t.id === 'file') {
    if (t.files?.[0]) takeFile(t.files[0]);
    return;
  }
  if (t.dataset.job !== undefined) return onJobDate(t);
  if (t.dataset.edu !== undefined && S.resume?.education) S.resume.education[Number(t.dataset.edu)].year = Number(t.value);
  else if (t.id === 'add-country') {
    if (t.value) {
      S.countries.push({ name: t.value, value: 'need' });
      render();
    }
    return;
  } else if (onChoice(t)) return;
  refresh();
}

function onInput(e: Event) {
  const t = e.target as HTMLInputElement;
  if (t.id === 'current') {
    S.current = t.value;
    moneyUpdate();
  } else if (t.id === 'expected-other') {
    S.expectedOther = t.value;
    const out = $('#other-words');
    if (out) out.textContent = num(S.expectedOther) ? words(num(S.expectedOther), S.currency, S.period) : '';
  } else return;
  refresh();
}

function startOver() {
  Object.assign(S, newState());
  forget();
  history.replaceState(null, '', location.pathname + location.search);
  render();
}

function onSkillStep(t: HTMLElement) {
  const k = t.dataset.skill ?? '';
  S.skills[k] = Math.max(0, Math.min(15, (S.skills[k] ?? 0) + Number(t.dataset.step)));
  const out = t.parentElement?.querySelector('output');
  if (out) out.textContent = yrs(S.skills[k]);
  refresh();
}

function onClick(e: Event) {
  const t = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!t) return;
  const actions: Record<string, () => void> = {
    back: () => go(S.step - 1),
    skip: () => {
      S.northlist = 'later';
      go(S.step + 1);
    },
    'edit-jobs': () => {
      S.editJobs = true;
      render();
    },
    'change-file': startOver,
    sample: () => {
      takeFile({ name: 'Sample_Resume.pdf', size: 186412, type: 'application/pdf' });
      setTimeout(() => (location.hash = JSON.stringify({ ...SAMPLE, resumeFile: S.file })), 2400);
    },
  };
  if (actions[t.id]) return actions[t.id]();
  if (t.dataset.step) return onSkillStep(t);
  if (t.dataset.removeJob) S.jobs.splice(Number(t.dataset.removeJob), 1);
  else if (t.dataset.remove) S.countries.splice(Number(t.dataset.remove), 1);
  else if (t.dataset.add) return addItem(t.dataset.add);
  else return;
  render();
}

/* ── Wiring ─────────────────────────────────────────── */
function wire() {
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (current.blocked) return;
    if (S.step === NL) {
      S.northlist = 'opened';
      window.open(NL_SETUP, '_blank', 'noopener');
    }
    go(S.step + 1);
  });
  form.addEventListener('click', onClick);
  form.addEventListener('change', onChange);
  form.addEventListener('input', onInput);
  form.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t.matches('#add-location, #add-title, #add-skip')) {
      e.preventDefault();
      addItem(t.id.slice(4));
    } else if ((e.key === 'Enter' || e.key === ' ') && t.id === 'drop') {
      e.preventDefault();
      $('#file')?.click();
    }
  });
  // Enter continues from anywhere, except in a text box, a list, a link or on a button
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || t.closest('textarea, input[type=text], button, select, a, #drop')) return;
    e.preventDefault();
    form.requestSubmit();
  });
  const onDrop = (e: DragEvent) => {
    if (!(e.target as HTMLElement).closest('#drop')) return;
    e.preventDefault();
    $('#drop')?.classList.toggle('over', e.type === 'dragover');
    const f = e.type === 'drop' ? e.dataTransfer?.files[0] : undefined;
    if (f) takeFile(f);
  };
  for (const type of ['dragover', 'dragleave', 'drop'] as const) form.addEventListener(type, onDrop);
  addEventListener('resize', () => {
    fitScene();
    fitStrip();
  });
  // The AI fills in the page by changing the link; the page then moves on by itself
  addEventListener('hashchange', () => {
    const R = readFacts(location.hash);
    if (!applyResume(S, R)) return;
    if (R?.resumeFile && !S.file) S.file = R.resumeFile;
    render();
    if (S.step === 0) setTimeout(() => S.step === 0 && go(1), 1800);
  });
}

/* ── Light / dark: dark by default, the choice remembered on this computer ── */
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
if (params.has('fresh')) forget();
const ringsEl = $('#rings');
if (ringsEl) ringsEl.innerHTML = rings();
wire();
wireTheme();
const first = readFacts(location.hash);
// The resume was given in the chat first: the facts are in the link, so start at "Is this you?"
if (!restore(first) && applyResume(S, first)) {
  S.file = (first?.resumeFile as FileInfo | undefined) ?? { name: 'resume.pdf', size: 0 };
  S.step = 1;
}
render();
