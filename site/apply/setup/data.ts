/*
 * NorthList Apply setup page (owner, 23 Nov 2026; clean light look and more questions, 24 Nov): the state and
 * the plain rules, with no page code, so the tests can check them. The user's AI puts what it read from the resume after "#" in the link (never sent to
 * a server); the page asks the rest; the AI reads the answers back from the block between
 * BEGIN/END NORTHLIST ANSWERS (instructions/setup_page.md in northlist-apply).
 */

export interface Ym {
  y: number;
  m: number;
}
export interface FileInfo {
  name: string;
  size: number;
}
export interface Employer {
  company: string;
  title: string;
  start?: string;
  end?: string;
}
export interface Education {
  degree?: string;
  field?: string;
  institution?: string;
  year?: number | string;
}
export type Auth = 'yes' | 'later' | 'need';
export interface Resume {
  firstName: string;
  lastName?: string;
  email?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  city?: string;
  country?: string;
  currentTitle?: string;
  employers?: Employer[];
  education?: Education[];
  skillYears?: Record<string, number>;
  englishGuess?: string;
  suggestedTitles?: string[];
  checkedTitles?: string[];
  suggestedLocations?: string[];
  checkedLocations?: string[];
  currency?: string;
  noticeDays?: number;
  currentSalary?: number;
  expectedSalary?: number;
  salaryPeriod?: string;
  workModes?: string[];
  relocate?: boolean;
  workAuth?: { country: string; value: string }[];
  /** Links the resume shows, also the ones behind words like "LinkedIn". */
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  /** Only when the resume says them: many resumes list these under "Personal details". */
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  postalCode?: string;
  marks?: string;
  resumeFile?: FileInfo;
  northlistConnected?: boolean;
}
/** The answers that are plain text the user may type or fix. */
export type TextKey = 'linkedin' | 'github' | 'portfolio' | 'nationality' | 'postal' | 'marks';
export interface Dob {
  d: string;
  m: string;
  y: string;
}
export interface Job {
  company: string;
  title: string;
  start: Ym;
  end: Ym | null;
  check?: boolean;
}
export interface Country {
  name: string;
  value: Auth;
}
export type Period = 'annual' | 'monthly';
export type NorthList = 'later' | 'opened' | 'connected';

export interface State {
  step: number;
  file: FileInfo | null;
  resume: Resume | null;
  editJobs: boolean;
  jobs: Job[];
  notice: string;
  currency: string;
  current: string;
  period: Period;
  currentNone: boolean;
  expected: string;
  expectedTouched: boolean;
  expectedOther: string;
  countries: Country[];
  modes: string[];
  locations: string[];
  relocate: boolean;
  titles: string[];
  extraTitles: string[];
  skipCurrent: boolean;
  skipOthers: string[];
  skills: Record<string, number>;
  english: string;
  unlisted: string;
  previous: string;
  northlist: NorthList;
  from: Record<string, boolean>;
  linkedin: string;
  github: string;
  portfolio: string;
  dob: Dob;
  gender: string;
  nationality: string;
  postal: string;
  marks: string;
  convicted: string;
  compete: string;
}

export const newState = (): State => ({
  step: 0,
  file: null,
  resume: null,
  editJobs: false,
  jobs: [],
  notice: '',
  currency: 'INR',
  current: '',
  period: 'annual',
  currentNone: false,
  expected: '30',
  expectedTouched: false,
  expectedOther: '',
  countries: [],
  // Everything is picked from the start (owner, 24 Nov 2026): the user only takes away what does not fit
  modes: ['remote', 'hybrid', 'onsite'],
  locations: [],
  relocate: true,
  titles: [],
  extraTitles: [],
  skipCurrent: true,
  skipOthers: [],
  skills: {},
  english: 'Professional',
  unlisted: 'Answer 0 years',
  previous: 'No, unless the company is in my work history',
  northlist: 'later',
  from: {},
  linkedin: '',
  github: '',
  portfolio: '',
  dob: { d: '', m: '', y: '' },
  gender: '',
  nationality: '',
  postal: '',
  marks: '',
  convicted: '',
  compete: '',
});

/** 9 short screens, then Done. "Details" holds the facts company sites require (birth date, gender and so on). */
export const STEPS = ['Resume', 'About you', 'Skills', 'Notice and pay', 'Where', 'Work permission', 'Details', 'Jobs', 'NorthList', 'Done'];
export const DONE = STEPS.length - 1;
export const NL = DONE - 1;
export const YEARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'United Arab Emirates', 'Singapore', 'Germany', 'Netherlands', 'Australia', 'Ireland'];
export const MODE_NAMES: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Office' };
export const GENDERS = ['Woman', 'Man', 'Another', 'Prefer not to say'];
const NATIONALITY: Record<string, string> = {
  India: 'Indian',
  'United States': 'American',
  'United Kingdom': 'British',
  Canada: 'Canadian',
  'United Arab Emirates': 'Emirati',
  Singapore: 'Singaporean',
  Germany: 'German',
  Netherlands: 'Dutch',
  Australia: 'Australian',
  Ireland: 'Irish',
};

/** Money fields take digits only; they are shown grouped the way the country writes them. */
export const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '').slice(0, 11);
export const grouped = (s: unknown, cur: string) => (digits(s) ? Number(digits(s)).toLocaleString(cur === 'INR' ? 'en-IN' : 'en-US') : '');

export const num = (s: unknown) => Number(String(s ?? '').replace(/[^\d.]/g, '')) || 0;
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
export const yrs = (v: number) => `${YEARS[v]} yr${v === 1 ? '' : 's'}`;

/** The facts after "#" in the link, or null. */
export function readFacts(hash: string): Resume | null {
  try {
    const h = decodeURIComponent(hash.replace(/^#/, ''));
    return h.startsWith('{') ? (JSON.parse(h) as Resume) : null;
  } catch {
    return null;
  }
}

/** Short country names some AIs write. */
const COUNTRY_ALIAS: Record<string, string> = {
  USA: 'United States',
  US: 'United States',
  'U.S.': 'United States',
  'U.S.A.': 'United States',
  UK: 'United Kingdom',
  'U.K.': 'United Kingdom',
  UAE: 'United Arab Emirates',
};
export const fullCountry = (c: unknown) => {
  const s = String(c ?? '').trim();
  return COUNTRY_ALIAS[s] ?? s;
};

/** "Apr 2022", "2022-04", "2023" (January), "Present" (null). */
export function parseDate(s: unknown): Ym | null {
  if (!s || /present|now|current/i.test(String(s))) return null;
  let m = String(s).match(/^(\d{4})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2] - 1 };
  m = String(s).match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m) return { y: +m[2], m: Math.max(0, MONTHS.indexOf(m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase())) };
  m = String(s).match(/(\d{4})/);
  return m ? { y: +m[1], m: 0 } : null;
}
export const fmtDate = (d: Ym | null) => (d ? `${MONTHS[d.m]} ${d.y}` : 'Present');
export const iso = (d: Ym | null) => (d ? `${d.y}-${String(d.m + 1).padStart(2, '0')}` : 'Present');
const monthIndex = (d: Ym) => d.y * 12 + d.m;
export const badDates = (jobs: Job[]) => jobs.some((j) => j.end && monthIndex(j.start) > monthIndex(j.end));

/** Years worked with one decimal (18 months = 1.5); overlapping jobs count once. */
export function totalYearsCount(jobs: Job[], today = new Date()): number {
  const cur = { y: today.getFullYear(), m: today.getMonth() };
  const spans = jobs.map((j) => [monthIndex(j.start), monthIndex(j.end ?? cur)]).sort((a, b) => a[0] - b[0]);
  let months = 0;
  let edge = -Infinity;
  for (const [a, b] of spans) {
    const from = Math.max(a, edge);
    if (b > from) months += b - from;
    edge = Math.max(edge, b);
  }
  return Math.round((months * 10) / 12) / 10;
}
export const totalYears = (jobs: Job[], today = new Date()) => {
  const n = totalYearsCount(jobs, today);
  return `${n} year${n === 1 ? '' : 's'}`;
};

/** Money in words: lakh and crore for rupees. */
export function words(n: number, cur: string, per: Period, short = false): string {
  if (!n) return '';
  const per1 = per === 'monthly' ? ' a month' : ' a year';
  const p = short ? '' : per1;
  if (cur === 'INR') {
    if (n >= 1e7) return `₹${+(n / 1e7).toFixed(2)} crore${p}`;
    if (n >= 1e5) return `₹${+(n / 1e5).toFixed(2)} lakh${p}`;
    return `₹${n.toLocaleString('en-IN')}${p}`;
  }
  const sym = ({ USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[cur];
  return `${sym ?? `${cur} `}${n.toLocaleString('en-US')}${p}`;
}
export const currentAmount = (S: State) => (S.currentNone ? 0 : num(S.current));
export function expectedAmount(S: State): number | null {
  if (S.expected === 'none') return null;
  if (S.expected === 'other') return num(S.expectedOther);
  const c = currentAmount(S);
  return c ? Math.round(c * (1 + Number(S.expected) / 100)) : 0;
}
/** Until the user picks, the raise follows the salary: +30% when there is one. */
export function settleExpected(S: State) {
  const c = currentAmount(S);
  const none = S.currentNone ? 'none' : 'other';
  if (!S.expectedTouched) S.expected = c ? '30' : none;
  else if (!c && /^\d+$/.test(S.expected)) S.expected = 'other';
}

function jobsFrom(R: Resume, today: Date): Job[] {
  return (R.employers ?? []).map((e) => {
    const end = parseDate(e.end);
    const start = parseDate(e.start);
    // No start date read: January of the end year, and the date pickers open so the user checks it
    const fallback = { y: (end ?? { y: today.getFullYear() }).y, m: 0 };
    return { company: e.company, title: e.title, start: start ?? fallback, end, check: !start };
  });
}

/** Facts the resume states are picked for the user and marked "from your resume". */
function statedFacts(S: State, R: Resume) {
  S.from = {};
  if (Number.isFinite(R.noticeDays)) {
    S.notice = String(R.noticeDays);
    S.from.notice = true;
  }
  if (R.salaryPeriod === 'monthly') S.period = 'monthly';
  if ((R.currentSalary ?? 0) > 0) {
    S.current = String(R.currentSalary);
    S.from.current = true;
  }
  if ((R.expectedSalary ?? 0) > 0) {
    Object.assign(S, { expected: 'other', expectedOther: String(R.expectedSalary), expectedTouched: true });
    S.from.expected = true;
  }
  if (R.workModes?.length) {
    S.modes = R.workModes.filter((m) => m in MODE_NAMES);
    S.from.modes = true;
  }
  if (typeof R.relocate === 'boolean') {
    S.relocate = R.relocate;
    S.from.relocate = true;
  }
}

function permissionFrom(S: State, R: Resume) {
  if (!R.workAuth?.length) {
    if (!S.countries.length) S.countries = [{ name: R.country || 'India', value: 'yes' }];
    return;
  }
  const ok = (v: string): v is Auth => v === 'yes' || v === 'later' || v === 'need';
  S.countries = R.workAuth.filter((a) => a?.country).map((a) => ({ name: a.country, value: ok(a.value) ? a.value : 'yes' }));
  if (R.country && !S.countries.some((c) => c.name === R.country)) S.countries.unshift({ name: R.country, value: 'yes' });
  S.from.auth = true;
}

/** Links and personal details: what the resume says, never a guess (the nationality follows the country and can be changed). */
function detailsFrom(S: State, R: Resume) {
  const text: [TextKey, string | undefined][] = [
    ['linkedin', R.linkedinUrl],
    ['github', R.githubUrl],
    ['portfolio', R.portfolioUrl],
    ['nationality', R.nationality ?? NATIONALITY[R.country ?? '']],
    ['postal', R.postalCode],
    ['marks', R.marks],
  ];
  for (const [key, value] of text) if (!S[key] && value) S[key] = value;
  const born = String(R.dateOfBirth ?? '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (born && !S.dob.y) S.dob = { y: born[1], m: String(+born[2]), d: String(+born[3]) };
  if (!S.gender && R.gender && GENDERS.includes(R.gender)) S.gender = R.gender;
}

function normalize(R: Resume) {
  R.country = fullCountry(R.country);
  for (const a of R.workAuth ?? []) if (a) a.country = fullCountry(a.country);
}

/** Fill the state from the resume facts; false when they are not usable. */
export function applyResume(S: State, R: Resume | null, today = new Date()): boolean {
  if (!R?.firstName) return false;
  normalize(R);
  S.resume = R;
  S.currency = R.currency || S.currency;
  if (!S.locations.length) S.locations = [...new Set([...(R.checkedLocations ?? []), ...(R.suggestedLocations ?? [])])].filter((l) => !/^remote$/i.test(l));
  if (!S.titles.length) S.titles = [...(R.checkedTitles ?? [])];
  // Whole years only: an AI may write 3.5, and the steppers count in years
  S.skills = Object.fromEntries(Object.entries(R.skillYears ?? {}).map(([k, v]) => [k, Math.max(0, Math.min(15, Math.round(Number(v) || 0)))]));
  S.english = R.englishGuess || S.english;
  if (!S.jobs.length) S.jobs = jobsFrom(R, today);
  if (S.jobs.some((j) => j.check)) S.editJobs = true;
  S.northlist = R.northlistConnected ? 'connected' : S.northlist;
  statedFacts(S, R);
  permissionFrom(S, R);
  detailsFrom(S, R);
  return true;
}

export const whereLine = (S: State) => [...S.modes.map((m) => MODE_NAMES[m]), ...S.locations].join(', ');
export const permissionLine = (S: State) => S.countries.map((c) => c.name + (c.value === 'yes' ? '' : ' (visa)')).join(', ');

/** A yes/no the user may skip: only a real Yes or No is written. */
const yesNo = (v: string) => (v === 'Yes' || v === 'No' ? v : 'None');
/** YYYY-MM-DD, or None until day, month and year are all picked. */
export const birthDate = (b: Dob) => (b.d && b.m && b.y ? `${b.y}-${b.m.padStart(2, '0')}-${b.d.padStart(2, '0')}` : 'None');

/** Links and the details company sites ask: `None` for everything the user left out. */
function detailLines(S: State): string[] {
  const or = (v: string) => v.trim() || 'None';
  return [
    `- **LinkedIn Profile URL:** ${or(S.linkedin)}`,
    `- **GitHub Profile URL:** ${or(S.github)}`,
    `- **Personal Portfolio URL:** ${or(S.portfolio)}`,
    `- **Date of Birth:** ${birthDate(S.dob)}`,
    `- **Gender:** ${or(S.gender)}`,
    `- **Nationality:** ${or(S.nationality)}`,
    `- **Postal Code:** ${or(S.postal)}`,
    `- **Marks or CGPA (highest degree):** ${or(S.marks)}`,
    `- **Ever convicted of a crime:** ${yesNo(S.convicted)}`,
    `- **Bound by a non-compete agreement:** ${yesNo(S.compete)}`,
  ];
}

function profileLines(S: State): string[] {
  const cur = currentAmount(S);
  const exp = expectedAmount(S);
  const now = S.jobs.find((j) => !j.end);
  const skip = [...(S.skipCurrent && now ? [now.company] : []), ...S.skipOthers];
  const remote = S.modes.includes('remote') ? ['Remote'] : [];
  return [
    `- **Total Years of Experience:** ${totalYearsCount(S.jobs)}`,
    `- **Notice Period (Days):** ${S.notice}`,
    `- **Current Compensation Amount:** ${cur || 'None'}`,
    `- **Current Compensation Currency:** ${cur ? S.currency : 'None'}`,
    `- **Current Compensation Period:** ${cur ? S.period : 'None'}`,
    `- **Expected Compensation Amount:** ${exp || 'None'}`,
    `- **Expected Compensation Currency:** ${exp ? S.currency : 'None'}`,
    `- **Expected Compensation Period:** ${exp ? S.period : 'None'}`,
    `- **Target Job Titles:** ${S.titles.join(', ')}`,
    `- **Locations:** ${[...S.locations, ...remote].join('; ')}`,
    `- **Work Modes Accepted:** ${S.modes.join(' / ')}`,
    `- **Willing to Relocate:** ${S.relocate ? 'Yes' : 'No'}`,
    `- **Companies to Skip:** ${skip.join(', ') || 'None'}`,
    ...detailLines(S),
  ];
}

function formAnswerLines(S: State): string[] {
  const ed = (S.resume?.education ?? [])[0];
  const degree = ed ? `${`${ed.degree ?? ''} ${ed.field ?? ''}`.trim()}, ${ed.year}` : 'None';
  const skills = Object.entries(S.skills).map(([k, v]) => `${k}: ${YEARS[v]}`).join(', ');
  return [
    `- **Years of experience per skill:** ${skills || 'None'}`,
    `- **What should be answered for a skill not listed in my profile?:** ${S.unlisted}`,
    `- **Highest degree and year:** ${degree}`,
    `- **English level:** ${S.english}`,
    `- **Previously worked at this company / referred by an employee:** ${S.previous}`,
    '- **Other common application question:** None',
  ];
}

/** The block the AI copies into profile.md and form_answers.md: labels match the files exactly. */
export function answers(S: State): string {
  const L = ['BEGIN NORTHLIST ANSWERS', '', '## profile.md', ...profileLines(S), '', '## Work Authorization (replace the whole section)'];
  S.countries.forEach((c, i) =>
    L.push(
      `### Country ${i + 1}`,
      `- **Country:** ${c.name}`,
      `- **Work authorization:** ${c.value === 'need' ? 'No' : 'Yes'}`,
      `- **Sponsorship required now or in the future:** ${c.value === 'yes' ? 'No' : 'Yes'}`,
    ),
  );
  L.push('', '## form_answers.md', ...formAnswerLines(S), '', '## Employment History (replace the dates of each employer)');
  S.jobs.forEach((j, i) =>
    L.push(`### Employer ${i + 1}`, `- **Company:** ${j.company}`, `- **Job Title:** ${j.title}`, `- **Start Date:** ${iso(j.start)}`, `- **End Date:** ${iso(j.end)}`),
  );
  L.push('', '## Education (graduation years)');
  (S.resume?.education ?? []).forEach((e, i) =>
    L.push(`### Education ${i + 1}`, `- **Institution:** ${e.institution ?? ''}`, `- **Graduation Year:** ${e.year ?? ''}`),
  );
  const nl = { connected: 'connected', opened: 'setup page opened', later: 'not now' }[S.northlist];
  L.push('', `## NorthList: ${nl}`, '', 'END NORTHLIST ANSWERS');
  return L.join('\n');
}
