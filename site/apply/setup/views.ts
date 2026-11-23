/*
 * The setup page's screens (owner, 23 Nov 2026): one function per step, each returning its words and its
 * questions as HTML. Almost no typing: pills, cards, switches, steppers and lists.
 */
import {
  COUNTRIES,
  DONE,
  MONTHS,
  answers,
  badDates,
  currentAmount,
  esc,
  expectedAmount,
  fmtDate,
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
};
export const icon = (n: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* Small builders */
const q = (label: string, html: string, note = '') =>
  `<div class="q"><p class="q-label">${esc(label)}${note ? `<span>${esc(note)}</span>` : ''}</p>${html}</div>`;
/** One answer to pick: a radio (one of a group) or a checkbox (any of a group). */
interface Choice {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  on: boolean;
}
const input = (c: Choice) => `<input type="${c.type}" name="${c.name}" value="${esc(c.value)}"${c.on ? ' checked' : ''}>`;
interface CardOpts {
  small?: string;
  ic?: string;
  cls?: string;
}
const card = (c: Choice, title: string, o: CardOpts = {}) =>
  `<label class="card ${o.cls ?? ''}">${input(c)}` +
  `${o.ic ? `<span class="ic">${icon(o.ic)}</span>` : ''}<b>${esc(title)}</b>${o.small ? `<small>${esc(o.small)}</small>` : ''}` +
  `<span class="tick">${icon('check')}</span></label>`;
const chip = (c: Choice, label = c.value) => `<label class="chip">${input(c)}${icon('check')}${esc(label)}</label>`;
const seg = (name: string, items: [string, string][], value: string, full = false) =>
  `<div class="seg ${full ? 'full' : ''}" role="radiogroup">${items
    .map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}"${v === value ? ' checked' : ''}>${esc(l)}</label>`)
    .join('')}</div>`;
const addBox = (kind: string, placeholder: string) =>
  `<div class="add"><input type="text" id="add-${kind}" placeholder="${placeholder}" aria-label="${placeholder}">` +
  `<button type="button" class="btn btn-ghost" data-add="${kind}">${icon('plus')} Add</button></div>`;
export const initials = (R: Resume) => esc((R.firstName || '?')[0] + (R.lastName || ' ')[0]);
const CODES: Record<string, string> = {
  India: 'IN',
  'United States': 'US',
  'United Kingdom': 'UK',
  Canada: 'CA',
  'United Arab Emirates': 'AE',
  Singapore: 'SG',
  Germany: 'DE',
  Netherlands: 'NL',
  Australia: 'AU',
  Ireland: 'IE',
};
const code = (c: string) => CODES[c] ?? c.slice(0, 2).toUpperCase();
const fromNote = (S: State, k: string) => (S.from[k] ? 'from your resume' : '');

function noticeOptions(S: State): [string, string][] {
  const base: [string, string][] = [['0', 'Right away'], ['15', '15 days'], ['30', '30 days'], ['45', '45 days'], ['60', '60 days'], ['90', '90 days']];
  if (S.notice && !base.some(([v]) => v === S.notice)) base.push([S.notice, `${S.notice} days`]);
  return base.sort((a, b) => Number(a[0]) - Number(b[0]));
}

/** The raise picks under "What you want". Settles what "expected" is, so it runs before the step is checked. */
export function expectedHTML(S: State): string {
  settleExpected(S);
  const c = currentAmount(S);
  const raise = (v: string) => words(Math.round(c * (1 + Number(v) / 100)), S.currency, S.period, true);
  const cards = c
    ? `<div class="cards four">${['20', '30', '40', '50'].map((v) => card({ type: 'radio', name: 'expected', value: v, on: S.expected === v }, `+${v}%`, { small: raise(v), cls: 'big' })).join('')}</div>`
    : '';
  return `${cards}
    <div class="chips gap-top">${chip({ type: 'radio', name: 'expected', value: 'other', on: S.expected === 'other' }, 'Type an amount')}${chip({ type: 'radio', name: 'expected', value: 'none', on: S.expected === 'none' }, 'Prefer not to say')}</div>
    <div id="other-box" class="gap-top" ${S.expected === 'other' ? '' : 'hidden'}>
      <div class="field"><span class="field-tag">${esc(S.currency)}</span><span class="sep"></span><input type="text" id="expected-other" inputmode="numeric" autocomplete="off" aria-label="Amount you want" placeholder="Amount you want" value="${esc(S.expectedOther)}"></div>
      <p class="words" id="other-words">${num(S.expectedOther) ? esc(words(num(S.expectedOther), S.currency, S.period)) : ''}</p>
    </div>`;
}

/* ── 0 Resume ───────────────────────────────────────── */
/** One line of the "reading your resume" list: ticked once read, the first one turning while reading. */
function readingRow(label: string, i: number, read: boolean): string {
  const delay = `style="animation-delay:${i * 140}ms"`;
  if (read) return `<li class="ok" ${delay}><span class="st">${icon('check')}</span>${esc(label)}</li>`;
  const first = i === 0;
  return `<li class="${first ? 'now' : ''}" ${delay}><span class="st"></span><span class="${first ? 'shimmer' : ''}">${esc(label)}</span></li>`;
}

function resumeView(S: State, demo: boolean): View {
  const R = S.resume;
  const checks = ['Name and contact', 'Work history', 'Skills and years', 'Education'];
  const drop = `<div class="stagger">
      <label class="drop" id="drop" tabindex="0">
        <span class="up">${icon('upload')}</span>
        <b>Drop your resume here</b>
        <span class="hint">or <u>choose a file</u> · PDF</span>
        <input type="file" id="file" accept="application/pdf,.pdf" class="vh">
      </label>
      ${demo ? `<p class="note center"><button type="button" class="btn btn-ghost" id="sample">No resume handy? Try a sample</button></p>` : `<p class="note">Already gave it to your AI in the chat? This fills in by itself.</p>`}
    </div>`;
  const file = S.file;
  const reading = file
    ? `<div class="stagger">
      <div class="file"><span class="ic">${icon('file')}</span><div><b>${esc(file.name)}</b><small>${file.size ? `${(file.size / 1024).toFixed(0)} KB · ` : ''}${R ? 'Read' : 'Reading…'}</small></div>
        <button type="button" class="btn btn-plain" id="change-file">Change</button></div>
      <ul class="reading">${checks.map((c, i) => readingRow(c, i, Boolean(R))).join('')}</ul>
      ${R ? '' : `<p class="note">Your AI is reading it now. Nothing after a minute? Go back to the chat and type <b>done</b>.</p>`}
      <p class="vh">RESUME FILE: ${esc(file.name)} | ${file.size} bytes</p>
    </div>`
    : '';
  return {
    title: R ? `Nice to meet you, ${R.firstName}.` : "Let's start with your resume",
    sub: R ? 'We read your resume. Next, check what we found.' : 'Your AI reads it and fills in most answers for you. It stays on your computer.',
    blocked: !R,
    body: file ? reading : drop,
  };
}

/* ── 1 About you: facts from the resume; dates fixed with pickers, never typed ── */
const pick = (attrs: string, list: [number, string | number][], val: unknown, label: string) =>
  `<select ${attrs} aria-label="${label}">${list.map(([v, l]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

function jobRow(S: State, j: Job, i: number): string {
  if (!S.editJobs) return `<li class="${j.end ? '' : 'cur'}"><div>${esc(j.title)}<span>${esc(j.company)}</span></div><small>${fmtDate(j.start)} – ${fmtDate(j.end)}</small></li>`;
  const today = new Date();
  const monthList = MONTHS.map((m, k): [number, string] => [k, m]);
  const yearList = Array.from({ length: today.getFullYear() - 1979 }, (_, k): [number, number] => [today.getFullYear() - k, today.getFullYear() - k]);
  const remove = S.jobs.length > 1 ? `<button type="button" class="btn btn-plain icon-btn" data-remove-job="${i}" aria-label="Remove ${esc(j.company)}">${icon('x')}</button>` : '';
  const end = j.end ?? { y: today.getFullYear(), m: today.getMonth() };
  return `<li class="edit ${j.end ? '' : 'cur'}">
    <div class="job-top"><div>${esc(j.title)}<span>${esc(j.company)}</span></div>${remove}</div>
    <div class="dates">
      <div class="date"><small>${j.check ? 'Started · please check' : 'Started'}</small><div class="date-pick">${pick(`data-job="${i}" data-part="sm"`, monthList, j.start.m, 'Start month')}${pick(`data-job="${i}" data-part="sy"`, yearList, j.start.y, 'Start year')}</div></div>
      <div class="date"><small>Left</small><div class="date-pick" ${j.end ? '' : 'hidden'}>${pick(`data-job="${i}" data-part="em"`, monthList, end.m, 'End month')}${pick(`data-job="${i}" data-part="ey"`, yearList, end.y, 'End year')}</div>
        <label class="mini-switch"><input type="checkbox" data-job="${i}" data-part="now" ${j.end ? '' : 'checked'}>I work here now</label></div>
    </div></li>`;
}

function educationRows(S: State, R: Resume): string {
  const thisYear = new Date().getFullYear();
  const yearList = Array.from({ length: thisYear - 1969 }, (_, k): [number, number] => [thisYear + 1 - k, thisYear + 1 - k]);
  return (R.education ?? [])
    .map((e, i) =>
      S.editJobs
        ? `<li class="edit"><div class="job-top"><div>${esc(e.degree)} ${esc(e.field ?? '')}<span>${esc(e.institution)}</span></div></div><div class="dates"><div class="date"><small>Finished</small><div class="date-pick">${pick(`data-edu="${i}"`, yearList, e.year, 'Year finished')}</div></div></div></li>`
        : `<li><div>${esc(e.degree)} ${esc(e.field ?? '')}<span>${esc(e.institution)}</span></div><small>${esc(e.year)}</small></li>`,
    )
    .join('');
}

function aboutView(S: State): View {
  const R = S.resume ?? { firstName: '' };
  const fix = S.editJobs
    ? `<p class="note flush">Name, email or phone wrong? Tell your AI in the chat.</p>`
    : `<button type="button" class="btn btn-plain flush-left" id="edit-jobs">${icon('pencil')} Fix dates</button>`;
  return {
    title: 'Is this you?',
    sub: 'From your resume. Forms use these facts as they are.',
    cta: S.editJobs ? 'Save and continue' : "Yes, that's me",
    blocked: badDates(S.jobs),
    body: `<div class="stagger">
      <div class="me">
        <div class="me-head"><span class="avatar">${initials(R)}</span><div><b>${esc(R.firstName)} ${esc(R.lastName)}</b><small>${esc(R.currentTitle)} · <span id="total-years">${totalYears(S.jobs)}</span></small></div></div>
        <div class="me-meta"><span>${icon('mail')}${esc(R.email)}</span><span>${icon('phone')}${esc(R.phoneCountryCode)} ${esc(R.phoneNumber)}</span><span>${icon('pin')}${esc(R.city)}, ${esc(R.country)}</span></div>
        <ul class="timeline">${S.jobs.map((j, i) => jobRow(S, j, i)).join('')}${educationRows(S, R)}</ul>
      </div>
      <div class="fixlink">${fix}</div>
    </div>`,
  };
}

/* ── 2 Skills ───────────────────────────────────────── */
function skillsView(S: State): View {
  const steppers = Object.entries(S.skills)
    .map(
      ([k, v]) =>
        `<div class="skill"><span>${esc(k)}</span><div class="stepper"><button type="button" data-step="-1" data-skill="${esc(k)}" aria-label="Fewer years of ${esc(k)}">${icon('minus')}</button><output aria-live="polite">${yrs(v)}</output><button type="button" data-step="1" data-skill="${esc(k)}" aria-label="More years of ${esc(k)}">${icon('plus')}</button></div></div>`,
    )
    .join('');
  return {
    title: 'Your skills',
    sub: 'Forms ask how many years you have with each one. We guessed from your resume.',
    body: `<div class="stagger">
      ${q('Years per skill', `<div class="skills">${steppers}</div>`, 'guessed')}
      ${q('Your English', seg('english', [['Native', 'Native'], ['Fluent', 'Fluent'], ['Professional', 'Work level'], ['Basic', 'Basic']], S.english, true))}
      ${q("When a form asks about a skill you don't have", seg('unlisted', [['Answer 0 years', 'Answer 0 years'], ['Ask me first', 'Ask me first']], S.unlisted, true))}
    </div>`,
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
    body: `<div class="stagger">
      ${q('When can you start?', `<div class="chips">${noticeOptions(S).map(([v, l]) => chip({ type: 'radio', name: 'notice', value: v, on: S.notice === v }, l)).join('')}</div>`, fromNote(S, 'notice'))}
      ${q(
        'What you earn now',
        `<div class="money-row">
          <div class="field"><select id="currency" aria-label="Currency">${currencies}</select><span class="sep"></span>
            <input type="text" id="current" inputmode="numeric" autocomplete="off" aria-label="What you earn now" placeholder="${S.currentNone ? 'Not shared' : 'Amount'}" value="${esc(S.current)}" ${S.currentNone ? 'disabled' : ''}></div>
          ${seg('period', [['annual', 'A year'], ['monthly', 'A month']], S.period)}
        </div>
        <p class="words" id="current-words">${cur ? esc(words(cur, S.currency, S.period)) : ''}</p>
        <div class="chips">${chip({ type: 'checkbox', name: 'currentNone', value: '1', on: S.currentNone }, 'Prefer not to say')}</div>`,
        fromNote(S, 'current'),
      )}
      ${q('What you want', `<div id="expected-box">${expBox}</div>`, S.from.expected ? 'from your resume' : 'pick a raise')}
    </div>`,
  };
}

/* ── 4 Where ────────────────────────────────────────── */
function whereView(S: State): View {
  const R = S.resume;
  const cities = [...new Set([...(R?.suggestedLocations ?? []), ...S.locations])].filter((l) => !/^remote$/i.test(l));
  const modes: [string, string, string, string][] = [
    ['remote', 'Remote', 'From home', 'home'],
    ['hybrid', 'Hybrid', 'Some days in', 'swap'],
    ['onsite', 'Office', 'Every day', 'building'],
  ];
  return {
    title: 'Where do you want to work?',
    sub: 'Picked from your resume. Tap to change.',
    blocked: !S.modes.length || (!S.locations.length && !S.modes.includes('remote')),
    body: `<div class="stagger">
      ${q('How', `<div class="cards">${modes.map(([v, l, s, ic]) => card({ type: 'checkbox', name: 'mode', value: v, on: S.modes.includes(v) }, l, { small: s, ic })).join('')}</div>`, fromNote(S, 'modes') || 'one or more')}
      ${q('Cities', `<div class="chips">${cities.map((l) => chip({ type: 'checkbox', name: 'location', value: l, on: S.locations.includes(l) })).join('')}</div>${addBox('location', 'Add a city')}`)}
      ${q('Moving', `<label class="switch"><span>Open to moving to another city<small>Jobs in other cities show up too</small></span><input type="checkbox" id="relocate" ${S.relocate ? 'checked' : ''}></label>`, fromNote(S, 'relocate'))}
    </div>`,
  };
}

/* ── 5 Work permission ──────────────────────────────── */
function permissionView(S: State): View {
  const left = COUNTRIES.filter((c) => !S.countries.some((x) => x.name === c));
  const rows = S.countries
    .map((c, i) => {
      const remove = i ? `<button type="button" class="btn btn-plain icon-btn" data-remove="${i}" aria-label="Remove ${esc(c.name)}">${icon('x')}</button>` : '';
      const choice = seg(`country-${i}`, [['yes', 'No visa needed'], ['later', 'Visa later'], ['need', 'Need a visa']], c.value, true);
      return `<div class="country"><div class="country-head"><span class="code">${code(c.name)}</span>${esc(c.name)}${remove}</div>${choice}</div>`;
    })
    .join('');
  return {
    title: 'Where can you work without a visa?',
    sub: 'Forms ask about work permission and visa sponsorship for each country.',
    blocked: !S.countries.length,
    body: `<div class="stagger">
      <div class="countries">${rows}</div>
      <select class="add-country" id="add-country" aria-label="Add a country"><option value="">+ Add a country you would move to</option>${left.map((c) => `<option>${c}</option>`).join('')}</select>
    </div>`,
  };
}

/* ── 6 Jobs ─────────────────────────────────────────── */
function jobsView(S: State): View {
  const titles = [...new Set([...(S.resume?.suggestedTitles ?? []), ...S.extraTitles])];
  const now = S.jobs.find((j) => !j.end);
  const current = now
    ? `<label class="switch"><span>Never apply to ${esc(now.company)}<small>Where you work now</small></span><input type="checkbox" id="skip-current" ${S.skipCurrent ? 'checked' : ''}></label>`
    : '';
  const others = S.skipOthers.length ? `<div class="chips gap-top">${S.skipOthers.map((c) => chip({ type: 'checkbox', name: 'skipOther', value: c, on: true })).join('')}</div>` : '';
  return {
    title: 'Which jobs should it apply to?',
    sub: 'Suggested from your resume. Pick one or more.',
    blocked: !S.titles.length,
    body: `<div class="stagger">
      ${q('Job titles', `<div class="chips">${titles.map((t) => chip({ type: 'checkbox', name: 'title', value: t, on: S.titles.includes(t) })).join('')}</div>${addBox('title', 'Add a job title')}`, 'one or more')}
      ${q('Companies to skip', `${current}${others}${addBox('skip', 'Another company to skip')}`, 'optional')}
    </div>`,
  };
}

/* ── 7 NorthList ────────────────────────────────────── */
const northListView = (): View => ({
  title: 'Track every application in one place',
  sub: 'Connect NorthList, and everything your AI sends shows up there by itself.',
  cta: 'Connect NorthList',
  skip: true,
  body: `<div class="stagger">
    <ul class="perks">
      <li><span class="ic">${icon('layers')}</span><div><b>From every site</b><span>LinkedIn, Naukri, Indeed, Workday, company pages and more, in one list</span></div></li>
      <li><span class="ic">${icon('pulse')}</span><div><b>See where your AI is applying</b><span>Each job it sends, with the answers it gave</span></div></li>
      <li><span class="ic">${icon('mail')}</span><div><b>Replies, sorted for you</b><span>Interview calls and rejections from your Gmail, next to each job</span></div></li>
      <li><span class="ic">${icon('phone')}</span><div><b>On your phone too</b><span>Install NorthList and get an alert when a company replies. <a class="inline-link" href="${NL_MOBILE}" target="_blank" rel="noopener">See it on a phone</a></span></div></li>
    </ul>
    <a class="film" href="${NL_HOME}" target="_blank" rel="noopener"><span class="film-thumb"><span>${icon('play')}</span></span><span><b>Watch NorthList in 60 seconds</b><small>northlist.site</small></span></a>
  </div>`,
});

/* ── 8 Done ─────────────────────────────────────────── */
function doneView(S: State): View {
  const exp = expectedAmount(S);
  const pay = S.currentNone ? 'Not shared' : `${words(currentAmount(S), S.currency, S.period)}${exp ? ` → ${words(exp, S.currency, S.period, true)}` : ''}`;
  const rows: [string, string][] = [
    ['Notice', S.notice === '0' ? 'Right away' : `${S.notice} days`],
    ['Pay', pay],
    ['Where', whereLine(S)],
    ['Can work in', permissionLine(S)],
    ['Jobs', S.titles.join(', ')],
  ];
  return {
    title: "You're all set.",
    sub: 'Go back to your AI chat. It is saving your answers now, so there is nothing to type.',
    done: true,
    body: `<div class="stagger">
      <svg class="done-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30"/><path d="M20 33l8 8 16-17"/></svg>
      <p class="status"><span class="dot live"></span><span class="shimmer">Your AI is saving your answers…</span></p>
      <dl class="saved">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="for-ai"><p>For your AI · Nothing after a minute? Type <b>done</b> in the chat.</p><pre id="northlist-answers">${esc(answers(S))}</pre></div>
    </div>`,
  };
}

/** The screen for the current step. */
export function view(S: State, demo: boolean): View {
  const views = [() => resumeView(S, demo), () => aboutView(S), () => skillsView(S), () => payView(S), () => whereView(S), () => permissionView(S), () => jobsView(S), northListView, () => doneView(S)];
  return views[Math.min(S.step, DONE)]();
}
