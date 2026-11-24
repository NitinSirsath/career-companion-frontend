/*
 * The setup page's screens (owner, 23 Nov 2026; clean look, 24 Nov): one function per step, each returning
 * its words and its questions as HTML. One column and no boxes: thin lines between rows, fields as a line,
 * choices as plain words with a dark pill on the picked ones. Almost no typing.
 */
import {
  COUNTRIES,
  DONE,
  GENDERS,
  MONTHS,
  answers,
  badDates,
  currentAmount,
  esc,
  expectedAmount,
  fmtDate,
  grouped,
  num,
  permissionLine,
  settleExpected,
  totalYears,
  whereLine,
  words,
  yrs,
  type Job,
  type Resume,
  type State,
} from './data.ts';
import { picture } from './northlist.ts';

/** Connect = the NorthList Setup tab (sign-in first when needed, which comes back to it); the film is on Home. */
export const NL_SETUP = 'https://app.northlist.site/automation?tab=setup';
export const NL_HOME = 'https://northlist.site/';
export const NL_MOBILE = 'https://northlist.site/mobile';

export interface View {
  title: string;
  sub: string;
  body: string;
  cta?: string;
  blocked?: boolean;
  skip?: boolean;
  done?: boolean;
}

/* Lucide shapes */
const P: Record<string, string> = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M11 18h2"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  play: '<path d="M6 3l14 9-14 9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sparkle: '<path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};
export const icon = (n: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* Small builders */
/** A question: its words, then its control. A real fieldset, so the choices are announced as one group. */
const q = (label: string, html: string, note = '') =>
  `<fieldset class="q"><legend>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</legend>${html}</fieldset>`;
/** One answer to pick: a radio (one of a group) or a checkbox (any of a group), shown as a plain word. */
interface Choice {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  on: boolean;
}
const opt = (c: Choice, label = c.value) =>
  `<label><input class="vh" type="${c.type}" name="${c.name}" value="${esc(c.value)}"${c.on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
const opts = (html: string) => `<div class="opts">${html}</div>`;
const radios = (name: string, items: [string, string][], value: string) =>
  opts(items.map(([v, l]) => opt({ type: 'radio', name, value: v, on: v === value }, l)).join(''));
const addBox = (kind: string, placeholder: string) =>
  `<div class="add"><input class="field" type="text" id="add-${kind}" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off">` +
  `<button type="button" class="link" data-add="${kind}">Add</button></div>`;
const toggle = (id: string, on: boolean, title: string, small: string) =>
  `<ul class="rows"><li><label class="grow" for="${id}">${esc(title)}<small>${esc(small)}</small></label><input class="switch" type="checkbox" id="${id}" ${on ? 'checked' : ''}></li></ul>`;
const fromNote = (S: State, k: string) => (S.from[k] ? 'from your resume' : '');

function noticeOptions(S: State): [string, string][] {
  const base: [string, string][] = [['0', 'Right away'], ['15', '15 days'], ['30', '30 days'], ['45', '45 days'], ['60', '60 days'], ['90', '90 days']];
  if (S.notice && !base.some(([v]) => v === S.notice)) base.push([S.notice, `${S.notice} days`]);
  return base.sort((a, b) => Number(a[0]) - Number(b[0]));
}

/** What the picked raise comes to, in words. */
export function expectedWords(S: State): string {
  const n = expectedAmount(S);
  return n ? words(n, S.currency, S.period) : '';
}

/** The raise picks under "What you want". Settles what "expected" is, so it runs before the step is checked. */
export function expectedHTML(S: State): string {
  settleExpected(S);
  const c = currentAmount(S);
  const raises = c ? ['20', '30', '40', '50'].map((v) => opt({ type: 'radio', name: 'expected', value: v, on: S.expected === v }, `+${v}%`)).join('') : '';
  return `${opts(
    `${raises}${opt({ type: 'radio', name: 'expected', value: 'other', on: S.expected === 'other' }, 'Type an amount')}${opt({ type: 'radio', name: 'expected', value: 'none', on: S.expected === 'none' }, 'Prefer not to say')}`,
  )}
    <input class="field gap-top" type="text" id="expected-other" inputmode="numeric" autocomplete="off" aria-label="Amount you want" placeholder="Amount you want, numbers only" value="${esc(grouped(S.expectedOther, S.currency))}" ${S.expected === 'other' ? '' : 'hidden'}>
    <p class="words" id="expected-words">${esc(expectedWords(S))}</p>`;
}

/* ── 0 Resume ───────────────────────────────────────── */
function resumeView(S: State, demo: boolean): View {
  const R = S.resume;
  const checks = ['Name and contact', 'Work history', 'Skills and years', 'Education'];
  const drop = `<label class="drop" id="drop" tabindex="0">
        <b>Drop your resume here</b>
        <span>or <u>choose a file</u> · PDF</span>
        <input type="file" id="file" accept="application/pdf,.pdf" class="vh">
      </label>
      ${demo ? `<p class="note"><button type="button" class="link" id="sample">No resume handy? Try a sample</button></p>` : `<p class="note">Already gave it to your AI in the chat? This fills in by itself.</p>`}`;
  const file = S.file;
  const reading = file
    ? `<div class="filed"><span><b>${esc(file.name)}</b> <small>${file.size ? `· ${(file.size / 1024).toFixed(0)} KB ` : ''}· ${R ? 'Read' : 'Reading…'}</small></span>
        <button type="button" class="link" id="change-file">Change</button></div>
      <ul class="read ${R ? '' : 'busy'}">${checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      ${R ? '' : `<p class="note">Your AI is reading it now. Nothing after a minute? Go back to the chat and type <b>done</b>.</p>`}
      <p class="vh">RESUME FILE: ${esc(file.name)} | ${file.size} bytes</p>`
    : '';
  return {
    title: R ? `Nice to meet you, ${R.firstName}.` : "Let's start with your resume",
    sub: R ? 'Your AI read your resume. Next, check what it found.' : 'Your AI reads it and fills in most answers for you. It stays on your computer.',
    blocked: !R,
    body: file ? reading : drop,
  };
}

/* ── 1 About you: facts from the resume; dates fixed with two short lists, never typed ── */
const pick = (attrs: string, list: [number | string, string | number][], val: unknown, label: string) =>
  `<select class="field" ${attrs} aria-label="${label}">${list.map(([v, l]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

function jobRow(S: State, j: Job, i: number): string {
  const head = `<span class="k">${j.end ? 'Before' : 'Now'}</span>`;
  const what = `${esc(j.title)}, ${esc(j.company)}`;
  if (!S.editJobs) return `<div>${head}<span class="v">${what}<small>${fmtDate(j.start)} to ${j.end ? fmtDate(j.end) : 'now'}</small></span></div>`;
  const today = new Date();
  const monthList = MONTHS.map((m, k): [number, string] => [k, m]);
  const yearList = Array.from({ length: today.getFullYear() - 1979 }, (_, k): [number, number] => [today.getFullYear() - k, today.getFullYear() - k]);
  const endMonths: [number | string, string][] = [['now', 'now'], ...monthList];
  const remove = S.jobs.length > 1 ? `<button type="button" class="link" data-remove-job="${i}" aria-label="Remove ${esc(j.company)}">Remove</button>` : '';
  return `<div>${head}<span class="v">${what}
      <span class="dates">${pick(`data-job="${i}" data-part="sm"`, monthList, j.start.m, 'Start month')}${pick(`data-job="${i}" data-part="sy"`, yearList, j.start.y, 'Start year')}<span>to</span>${pick(`data-job="${i}" data-part="em"`, endMonths, j.end ? j.end.m : 'now', 'End month')}${j.end ? pick(`data-job="${i}" data-part="ey"`, yearList, j.end.y, 'End year') : ''}${j.check ? '<span>please check the start</span>' : ''}</span>
    </span>${remove}</div>`;
}

function educationRows(S: State, R: Resume): string {
  const thisYear = new Date().getFullYear();
  const yearList = Array.from({ length: thisYear - 1969 }, (_, k): [number, number] => [thisYear + 1 - k, thisYear + 1 - k]);
  return (R.education ?? [])
    .map((e, i) => {
      const what = `${esc(e.degree)} ${esc(e.field ?? '')}, ${esc(e.institution)}`;
      const year = S.editJobs ? `<span class="dates">${pick(`data-edu="${i}"`, yearList, e.year, 'Year finished')}</span>` : `<small>${esc(e.year)}</small>`;
      return `<div><span class="k">${i ? '' : 'Education'}</span><span class="v">${what}${year}</span></div>`;
    })
    .join('');
}

const linkRow = (id: string, label: string, value: string) =>
  `<li><label class="k" for="${id}">${label}</label><input class="field v" type="text" id="${id}" value="${esc(value)}" placeholder="None" autocomplete="off" autocapitalize="none" spellcheck="false"></li>`;

function aboutView(S: State): View {
  const R = S.resume ?? { firstName: '' };
  return {
    title: 'Is this you?',
    sub: 'From your resume. Forms use these facts as they are.',
    cta: S.editJobs ? 'Save and continue' : "Yes, that's me",
    blocked: badDates(S.jobs),
    body: `<dl class="rows">
        <div><span class="k">Name</span><span class="v"><b>${esc(R.firstName)} ${esc(R.lastName)}</b></span></div>
        ${S.jobs.map((j, i) => jobRow(S, j, i)).join('')}
        <div><span class="k">Experience</span><span class="v" id="total-years">${totalYears(S.jobs)}</span><button type="button" class="link" id="edit-jobs">${S.editJobs ? 'Done' : 'Fix dates'}</button></div>
        ${educationRows(S, R)}
        <div><span class="k">Contact</span><span class="v">${esc(R.email)}<small>${esc(R.phoneCountryCode)} ${esc(R.phoneNumber)} · ${esc(R.city)}, ${esc(R.country)}</small></span></div>
      </dl>
      <p class="note">Name, email or phone wrong? Tell your AI in the chat.</p>
      ${q('Your links', `<ul class="rows">${linkRow('linkedin', 'LinkedIn', S.linkedin)}${linkRow('github', 'GitHub', S.github)}${linkRow('portfolio', 'Portfolio', S.portfolio)}</ul>`, 'from your resume')}`,
  };
}

/* ── 2 Skills ───────────────────────────────────────── */
function skillsView(S: State): View {
  const steppers = Object.entries(S.skills)
    .map(
      ([k, v]) =>
        `<li><span class="v"><b>${esc(k)}</b></span><span class="stepper"><button type="button" data-step="-1" data-skill="${esc(k)}" aria-label="Fewer years of ${esc(k)}">${icon('minus')}</button><output aria-live="polite">${yrs(v)}</output><button type="button" data-step="1" data-skill="${esc(k)}" aria-label="More years of ${esc(k)}">${icon('plus')}</button></span></li>`,
    )
    .join('');
  return {
    title: 'Your skills',
    sub: 'Forms ask how many years you have with each one. Guessed from your resume; change what is off.',
    body: `${q('Years per skill', `<ul class="rows">${steppers}</ul>`, 'guessed')}
      ${q('Your English', radios('english', [['Native', 'Native'], ['Fluent', 'Fluent'], ['Professional', 'Work level'], ['Basic', 'Basic']], S.english))}
      ${q("When a form asks about a skill you don't have", radios('unlisted', [['Answer 0 years', 'Answer 0 years'], ['Ask me first', 'Ask me first']], S.unlisted))}`,
  };
}

/* ── 3 Notice and pay ───────────────────────────────── */
function payView(S: State): View {
  const expBox = expectedHTML(S); // first: it settles what "expected" is
  const cur = currentAmount(S);
  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => `<option${c === S.currency ? ' selected' : ''}>${c}</option>`).join('');
  return {
    title: 'Notice and pay',
    sub: 'Almost every form asks these three.',
    blocked: !S.notice || (!S.currentNone && !num(S.current)) || (S.expected === 'other' && !num(S.expectedOther)),
    body: `${q('When can you start?', radios('notice', noticeOptions(S), S.notice), fromNote(S, 'notice'))}
      ${q(
        'What you earn now',
        `<div class="inline"><select class="field" id="currency" aria-label="Currency">${currencies}</select>
          <input class="field grow" type="text" id="current" inputmode="numeric" autocomplete="off" aria-label="What you earn now" placeholder="${S.currentNone ? 'Not shared' : 'Amount, numbers only'}" value="${esc(grouped(S.current, S.currency))}" ${S.currentNone ? 'disabled' : ''}></div>
        <p class="words" id="current-words">${cur ? esc(words(cur, S.currency, S.period)) : ''}</p>
        ${opts(`${opt({ type: 'radio', name: 'period', value: 'annual', on: S.period === 'annual' }, 'A year')}${opt({ type: 'radio', name: 'period', value: 'monthly', on: S.period === 'monthly' }, 'A month')}${opt({ type: 'checkbox', name: 'currentNone', value: '1', on: S.currentNone }, 'Prefer not to say')}`)}`,
        fromNote(S, 'current'),
      )}
      ${q('What you want', `<div id="expected-box">${expBox}</div>`, S.from.expected ? 'from your resume' : 'pick a raise')}`,
  };
}

/* ── 4 Where ────────────────────────────────────────── */
function whereView(S: State): View {
  const R = S.resume;
  const cities = [...new Set([...(R?.suggestedLocations ?? []), ...S.locations])].filter((l) => !/^remote$/i.test(l));
  const modes: [string, string][] = [['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'Office']];
  return {
    title: 'Where do you want to work?',
    sub: 'Everything is picked. Tap one to take it away.',
    blocked: !S.modes.length || (!S.locations.length && !S.modes.includes('remote')),
    body: `${q('How', opts(modes.map(([v, l]) => opt({ type: 'checkbox', name: 'mode', value: v, on: S.modes.includes(v) }, l)).join('')), fromNote(S, 'modes') || 'one or more')}
      ${q('Cities', `${opts(cities.map((l) => opt({ type: 'checkbox', name: 'location', value: l, on: S.locations.includes(l) })).join(''))}${addBox('location', 'Add a city')}`)}
      ${toggle('relocate', S.relocate, 'Open to moving to another city', 'Jobs in other cities fit too')}`,
  };
}

/* ── 5 Work permission ──────────────────────────────── */
function permissionView(S: State): View {
  const left = COUNTRIES.filter((c) => !S.countries.some((x) => x.name === c));
  const rows = S.countries
    .map((c, i) => {
      const remove = i ? `<button type="button" class="link" data-remove="${i}" aria-label="Remove ${esc(c.name)}">Remove</button>` : '';
      return `<fieldset class="q"><legend>${esc(c.name)}${remove}</legend>${radios(`country-${i}`, [['yes', 'No visa needed'], ['later', 'Visa later'], ['need', 'Need a visa']], c.value)}</fieldset>`;
    })
    .join('');
  return {
    title: 'Where can you work without a visa?',
    sub: 'Forms ask about work permission and visa sponsorship for each country.',
    blocked: !S.countries.length,
    body: `${rows}
      <select class="field" id="add-country" aria-label="Add a country"><option value="">Add a country you would move to</option>${left.map((c) => `<option>${c}</option>`).join('')}</select>`,
  };
}

/* ── 6 Details: what company sites require; every one can be skipped ── */
function detailsView(S: State): View {
  const thisYear = new Date().getFullYear();
  const list = (first: string, items: [number | string, string | number][]): [number | string, string | number][] => [['', first], ...items];
  const days = list('Day', Array.from({ length: 31 }, (_, k): [number, number] => [k + 1, k + 1]));
  const months = list('Month', MONTHS.map((m, k): [number, string] => [k + 1, m]));
  const years = list('Year', Array.from({ length: 60 }, (_, k): [number, number] => [thisYear - 16 - k, thisYear - 16 - k]));
  const yesNo = (name: string, value: string) => radios(name, [['No', 'No'], ['Yes', 'Yes'], ['Skip', 'Skip']], value);
  const row = (id: string, label: string, value: string, extra = '') =>
    `<li><label class="k" for="${id}">${label}</label><input class="field v" type="text" id="${id}" value="${esc(value)}" placeholder="Optional" autocomplete="off" ${extra}></li>`;
  return {
    title: 'Details forms ask',
    sub: 'Company sites often require these. Answer once, so your AI never has to stop for them. Skip any you like.',
    body: `${q('Date of birth', `<div class="inline">${pick('id="dob-d"', days, S.dob.d, 'Day')}${pick('id="dob-m"', months, S.dob.m, 'Month')}${pick('id="dob-y"', years, S.dob.y, 'Year')}</div>`)}
      ${q('Gender', opts(GENDERS.map((g) => opt({ type: 'radio', name: 'gender', value: g, on: S.gender === g })).join('')))}
      <ul class="rows gap-bottom">${row('nationality', 'Nationality', S.nationality)}${row('postal', 'Postal code', S.postal, 'inputmode="numeric"')}${row('marks', 'Marks or CGPA', S.marks)}</ul>
      ${q('Have you ever been convicted of a crime?', yesNo('convicted', S.convicted))}
      ${q('Are you bound by a non-compete agreement?', yesNo('compete', S.compete))}
      <p class="note">ID numbers (PAN, Aadhaar, passport) are never saved. A form that needs one waits for you.</p>`,
  };
}

/* ── 7 Jobs ─────────────────────────────────────────── */
function jobsView(S: State): View {
  const titles = [...new Set([...(S.resume?.suggestedTitles ?? []), ...S.extraTitles])];
  const now = S.jobs.find((j) => !j.end);
  const current = now ? toggle('skip-current', S.skipCurrent, `Never apply to ${now.company}`, 'Where you work now') : '';
  const others = S.skipOthers.length ? opts(S.skipOthers.map((c) => opt({ type: 'checkbox', name: 'skipOther', value: c, on: true })).join('')) : '';
  return {
    title: 'Which jobs should it apply to?',
    sub: 'Suggested from your resume. Pick one or more.',
    blocked: !S.titles.length,
    body: `${q('Job titles', `${opts(titles.map((t) => opt({ type: 'checkbox', name: 'title', value: t, on: S.titles.includes(t) })).join(''))}${addBox('title', 'Add a job title')}`, 'one or more')}
      ${q('Companies to skip', `${current}${others}${addBox('skip', 'Another company to skip')}`, 'optional')}`,
  };
}

/* ── 8 NorthList: a working picture of the app, not a list of claims ── */
const northListView = (): View => ({
  title: 'See every application in one place',
  sub: 'Connect NorthList, and every job your AI applies to shows up there by itself, with the answers it sent and the replies from your Gmail.',
  cta: 'Connect NorthList',
  skip: true,
  body: `${picture()}
    <p class="try"><span>Try it: tap a job to see what your AI sent, or pick a site. Also <a href="${NL_MOBILE}" target="_blank" rel="noopener">on your phone</a>.</span>
      <a class="film" href="${NL_HOME}" target="_blank" rel="noopener">${icon('play')}Watch NorthList in 60 seconds</a></p>`,
});

/* ── 9 Done ─────────────────────────────────────────── */
function doneView(S: State): View {
  const exp = expectedAmount(S);
  const pay = S.currentNone ? 'Not shared' : `${words(currentAmount(S), S.currency, S.period)}${exp ? ` → ${words(exp, S.currency, S.period, true)}` : ''}`;
  const rows: [string, string][] = [
    ['Notice', S.notice === '0' ? 'Right away' : `${S.notice} days`],
    ['Pay', pay],
    ['Where', `${whereLine(S)}${S.relocate ? ', open to moving' : ''}`],
    ['Can work in', permissionLine(S)],
    ['Jobs', S.titles.join(', ')],
  ];
  return {
    title: "You're all set.",
    sub: 'Go back to your AI chat. It is saving your answers now, so there is nothing to type.',
    done: true,
    body: `<p class="status"><i></i>Your AI is saving your answers…</p>
      <dl class="rows">${rows.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</dl>
      <div class="for-ai"><p>For your AI · Nothing after a minute? Type <b>done</b> in the chat.</p><pre id="northlist-answers">${esc(answers(S))}</pre></div>`,
  };
}

/** The screen for the current step. */
export function view(S: State, demo: boolean): View {
  const views = [() => resumeView(S, demo), () => aboutView(S), () => skillsView(S), () => payView(S), () => whereView(S), () => permissionView(S), () => detailsView(S), () => jobsView(S), northListView, () => doneView(S)];
  return views[Math.min(S.step, DONE)]();
}