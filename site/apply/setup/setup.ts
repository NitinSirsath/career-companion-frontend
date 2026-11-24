/*
 * NorthList Apply setup page, northlist.site/apply/setup (owner, 23 Nov 2026; clean look, 24 Nov). The user's
 * AI opens it from NorthList Apply (instructions/setup_page.md): the resume first, then 9 short screens, then
 * Done. The page sends nothing anywhere: the resume facts arrive after "#", the answers stay in this browser
 * until Done, and the AI reads them back from the page text. Light by default, with a light/dark switch.
 */
import {
  DONE,
  NL,
  STEPS,
  applyResume,
  badDates,
  currentAmount,
  digits,
  esc,
  grouped,
  newState,
  readFacts,
  totalYears,
  words,
  yrs,
  type FileInfo,
  type Resume,
  type State,
  type TextKey,
} from './data.ts';
import { pictureClick, play } from './northlist.ts';
import { NL_SETUP, expectedHTML, expectedWords, icon, view, type View } from './views.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const KEY = 'nl-apply-setup-2';
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
  linkedinUrl: 'https://www.linkedin.com/in/asha-rao',
  githubUrl: 'https://github.com/asharao',
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
  const back = S.step > 0 ? '<button type="button" class="quiet" id="back">Back</button>' : '<span></span>';
  const skip = v.skip ? '<button type="button" class="quiet" id="skip">Not now</button>' : '';
  return `<div class="foot">${back}<div class="right">${skip}<button type="submit" class="btn" ${v.blocked ? 'disabled' : ''}>${esc(v.cta ?? 'Continue')}</button></div></div>`;
}

/** The AI waits for this title: "Resume added" tells it to look for the dropped file, "Done" to read the answers. */
function pageTitle(v: View): string {
  if (v.done) return 'Done · NorthList Apply setup';
  return S.file && !S.resume ? 'Resume added · NorthList Apply setup' : 'NorthList Apply setup';
}

function render() {
  current = view(S, DEMO);
  const bar = $('#bar');
  if (bar) bar.style.width = `${(Math.min(S.step, DONE) / DONE) * 100}%`;
  // The AI reads this line when the user says "done" too early (instructions/setup_page.md, step 4)
  const note = $('#top-note');
  if (note) note.textContent = S.step === DONE ? 'Done' : `Step ${S.step + 1} of ${DONE} · ${STEPS[S.step]}`;
  if (form)
    form.innerHTML = `<h1 tabindex="-1">${esc(current.title)}</h1><p class="lead">${esc(current.sub)}</p>
      ${current.body}<p class="error" id="err" role="alert"></p>${footer(current)}`;
  document.title = pageTitle(current);
  if (S.step === NL) play();
  save();
}

/** After an answer: only the button changes, so nothing jumps. */
function refresh() {
  current = view(S, DEMO);
  const b = form?.querySelector<HTMLButtonElement>('.btn');
  if (b) {
    b.disabled = Boolean(current.blocked);
    b.textContent = current.cta ?? 'Continue';
  }
  save();
}

function go(to: number) {
  let next = Math.max(0, Math.min(DONE, to));
  if (next === NL && S.northlist === 'connected') next = next > S.step ? DONE : NL - 1; // already connected: no pitch
  if (next === S.step) return;
  const forward = next > S.step;
  let moved = false;
  const update = () => {
    if (moved) return;
    moved = true;
    S.step = next;
    render();
    form?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  };
  scrollTo(0, 0);
  // In a hidden tab (the AI app's browser is often in the background) a transition can be dropped with its update: no motion there
  if (!document.startViewTransition || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  const quiet = (t: ViewTransition) => {
    t.ready.catch(() => {});
    t.finished.catch(() => {});
  };
  try {
    quiet(document.startViewTransition({ update, types: [forward ? 'forward' : 'backward'] }));
  } catch {
    quiet(document.startViewTransition(update));
  }
  // A tab that is shown but not painting never runs the transition's update: move on without the motion
  setTimeout(update, 400);
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

/** Typing the salary only updates the words; the raise picks are rebuilt only when they appear or go. */
function moneyUpdate() {
  const n = currentAmount(S);
  const out = $('#current-words');
  if (out) out.textContent = n ? words(n, S.currency, S.period) : '';
  const box = $('#expected-box');
  if (!box) return;
  const hasRaises = Boolean(box.querySelector('input[name="expected"][value="30"]'));
  if (Boolean(n) !== hasRaises) box.innerHTML = expectedHTML(S);
  const want = $('#expected-words');
  if (want) want.textContent = expectedWords(S);
}

const checkedValues = (name: string) => [...(form?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`) ?? [])].map((x) => x.value);

/** A job's dates: two short lists each, and "now" for the job the user still has. */
function onJobDate(t: HTMLInputElement) {
  const j = S.jobs[Number(t.dataset.job)];
  const today = new Date();
  const part = t.dataset.part;
  if (part === 'em' && (t.value === 'now' || !j.end)) {
    j.end = t.value === 'now' ? null : { y: today.getFullYear(), m: Number(t.value) };
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
      const other = $<HTMLInputElement>('#expected-other');
      if (other) other.hidden = S.expected !== 'other';
      if (S.expected === 'other') other?.focus();
      const want = $('#expected-words');
      if (want) want.textContent = expectedWords(S);
    },
    mode: () => (S.modes = checkedValues('mode')),
    location: () => (S.locations = checkedValues('location')),
    title: () => (S.titles = checkedValues('title')),
    skipOther: () => (S.skipOthers = checkedValues('skipOther')),
    english: () => (S.english = t.value),
    unlisted: () => (S.unlisted = t.value),
    gender: () => (S.gender = t.value),
    convicted: () => (S.convicted = t.value),
    compete: () => (S.compete = t.value),
  };
  const byId: Record<string, () => void> = {
    currency: () => {
      S.currency = t.value;
      render();
    },
    relocate: () => (S.relocate = t.checked),
    'skip-current': () => (S.skipCurrent = t.checked),
    'dob-d': () => (S.dob.d = t.value),
    'dob-m': () => (S.dob.m = t.value),
    'dob-y': () => (S.dob.y = t.value),
  };
  if (t.name === 'currentNone') {
    S.currentNone = t.checked;
    if (t.checked) S.current = '';
    render();
    return true;
  }
  if (t.name.startsWith('country-')) S.countries[Number(t.name.slice(8))].value = t.value as State['countries'][number]['value'];
  else (byName[t.name] ?? byId[t.id])?.();
  return t.id === 'currency';
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

/** Text the user types. Money takes digits only and is shown grouped (18,00,000). */
const TEXT: Record<string, TextKey> = {
  linkedin: 'linkedin',
  github: 'github',
  portfolio: 'portfolio',
  nationality: 'nationality',
  postal: 'postal',
  marks: 'marks',
};
function onInput(e: Event) {
  const t = e.target as HTMLInputElement;
  if (t.id === 'current') {
    S.current = digits(t.value);
    t.value = grouped(S.current, S.currency);
    moneyUpdate();
  } else if (t.id === 'expected-other') {
    S.expectedOther = digits(t.value);
    t.value = grouped(S.expectedOther, S.currency);
    const want = $('#expected-words');
    if (want) want.textContent = expectedWords(S);
  } else if (TEXT[t.id]) S[TEXT[t.id]] = t.value;
  else return;
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
  if (pictureClick(t)) return;
  const actions: Record<string, () => void> = {
    back: () => go(S.step - 1),
    skip: () => {
      S.northlist = 'later';
      go(S.step + 1);
    },
    'edit-jobs': () => {
      S.editJobs = !S.editJobs;
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
  const onDrop = (e: DragEvent) => {
    if (!(e.target as HTMLElement).closest('#drop')) return;
    e.preventDefault();
    $('#drop')?.classList.toggle('over', e.type === 'dragover');
    const f = e.type === 'drop' ? e.dataTransfer?.files[0] : undefined;
    if (f) takeFile(f);
  };
  for (const type of ['dragover', 'dragleave', 'drop'] as const) form.addEventListener(type, onDrop);
  // The AI fills in the page by changing the link; the page then moves on by itself
  addEventListener('hashchange', () => {
    const R = readFacts(location.hash);
    if (!applyResume(S, R)) return;
    if (R?.resumeFile && !S.file) S.file = R.resumeFile;
    render();
    if (S.step === 0) setTimeout(() => S.step === 0 && go(1), 1800);
  });
}

/* ── Light / dark: light by default (owner, 24 Nov 2026), the choice remembered on this computer ── */
function drawTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const b = $('#theme');
  if (!b) return;
  b.innerHTML = icon(dark ? 'sun' : 'moon');
  b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
function wireTheme() {
  $('#theme')?.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme !== 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* not remembered */
    }
    drawTheme();
  });
  drawTheme();
}

/* ── Start ──────────────────────────────────────────── */
if (params.has('fresh')) forget();
wire();
wireTheme();
const first = readFacts(location.hash);
// The resume was given in the chat first: the facts are in the link, so start at "Is this you?"
if (!restore(first) && applyResume(S, first)) {
  S.file = (first?.resumeFile as FileInfo | undefined) ?? { name: 'resume.pdf', size: 0 };
  S.step = 1;
}
render();
