/*
 * The facts of "Today's run" (instructions/run_page.md in NorthList Apply) and the answers the AI reads
 * back. Plain functions, no page: the tests use them directly.
 */
export type Kind = 'yesno' | 'number' | 'choice' | 'text';
export interface Waiting {
  id: string;
  company: string;
  title: string;
  site: string;
  question: string;
  kind: Kind;
  options?: string[];
  draft?: string;
}
export interface Run {
  mode: 'report' | 'questions';
  date: string;
  firstName: string;
  plan: { site: string; planned: number; applied: number }[];
  applied: { company: string; title: string; site: string; time: string }[];
  skipped: { company: string; title: string; reason: string }[];
  waiting: Waiting[];
  stops: { site: string; message: string }[];
  passedOver: number;
  northlist: { connected: boolean; sent: number };
}
export interface Answer {
  value: string;
  /** Use this answer for every job, or only for this employer. */
  every: boolean;
}

/** The plan items as the user knows them. */
const SITE_NAMES: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  naukri: 'Naukri',
  wellfound: 'Wellfound',
  instahyre: 'Instahyre',
  workday: 'Workday',
  company_direct: 'Company sites',
  discovery: 'Web search',
  the_reliable_jobs: 'The Reliable Jobs',
  teksystems: 'TEKsystems',
  teksands: 'Teksands',
  d4hire: 'D4Hire',
  supersourcing: 'Supersourcing',
};
export const siteName = (s: string) => SITE_NAMES[s.trim().toLowerCase()] ?? s;

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
function text(v: unknown): string {
  if (typeof v === 'string') return v;
  return v == null ? '' : String(v);
}
const count = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const KINDS: Kind[] = ['yesno', 'number', 'choice', 'text'];

function waitingItem(raw: Record<string, unknown>, i: number): Waiting {
  const options = list<unknown>(raw.options).map(text).filter(Boolean);
  let kind = KINDS.includes(raw.kind as Kind) ? (raw.kind as Kind) : 'text';
  if (kind === 'choice' && !options.length) kind = 'text';
  return {
    id: text(raw.id) || `w${i + 1}`,
    company: text(raw.company),
    title: text(raw.title),
    site: siteName(text(raw.site)),
    question: text(raw.question),
    kind,
    ...(kind === 'choice' ? { options } : {}),
    ...(kind === 'text' && raw.draft ? { draft: text(raw.draft) } : {}),
  };
}

/** The facts after "#" in the link, made whole: a list the AI left out is empty. Null without facts. */
export function readRun(hash: string): Run | null {
  let raw: Record<string, unknown>;
  try {
    const h = decodeURIComponent(hash.replace(/^#/, ''));
    if (!h.startsWith('{')) return null;
    raw = JSON.parse(h) as Record<string, unknown>;
  } catch {
    return null;
  }
  const nl = (raw.northlist ?? {}) as Record<string, unknown>;
  return {
    mode: raw.mode === 'questions' ? 'questions' : 'report',
    date: text(raw.date),
    firstName: text(raw.firstName),
    plan: list<Record<string, unknown>>(raw.plan).map((p) => ({
      site: siteName(text(p.site)),
      planned: count(p.planned),
      applied: count(p.applied),
    })),
    applied: list<Record<string, unknown>>(raw.applied).map((a) => ({
      company: text(a.company),
      title: text(a.title),
      site: siteName(text(a.site)),
      time: text(a.time).slice(0, 5),
    })),
    skipped: list<Record<string, unknown>>(raw.skipped).map((s) => ({
      company: text(s.company),
      title: text(s.title),
      reason: text(s.reason),
    })),
    waiting: list<Record<string, unknown>>(raw.waiting)
      .map(waitingItem)
      .filter((w) => w.question),
    stops: list<Record<string, unknown>>(raw.stops).map((s) => ({
      site: siteName(text(s.site)),
      message: text(s.message),
    })),
    passedOver: count(raw.passedOver),
    northlist: { connected: nl.connected === true, sent: count(nl.sent) },
  };
}

/** A new answer: written questions start from the AI's draft and only for this employer. */
export const newAnswer = (w: Waiting): Answer => ({
  value: w.kind === 'text' ? (w.draft ?? '') : '',
  every: w.kind !== 'text',
});

/** Numbers of years, months, weeks or days get a stepper; other numbers (an amount) a box. */
export function numberUnit(question: string): string | null {
  const m = question.toLowerCase().match(/\b(year|month|week|day)s?\b/);
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1)}s` : null;
}

/** The held jobs, each with its questions, in the order they came. */
export function jobsOf(waiting: Waiting[]): Waiting[][] {
  const jobs = new Map<string, Waiting[]>();
  for (const w of waiting) {
    const key = `${w.company}|${w.title}|${w.site}`;
    jobs.set(key, [...(jobs.get(key) ?? []), w]);
  }
  return [...jobs.values()];
}

/** The answers in the record format of AGENTS.md section 7, and the jobs to apply to again. */
export function answersBlock(waiting: Waiting[], answers: Record<string, Answer>): string {
  const got = waiting.filter((w) => (answers[w.id]?.value ?? '').trim() !== '');
  const record = (w: Waiting) => {
    const a = answers[w.id];
    const ctx = a.every
      ? 'Employer=Any; Country=Any; Role=Any; Portal/ATS=Any'
      : `Employer=${w.company}; Country=Any; Role=${w.title}; Portal/ATS=${w.site}`;
    return [
      `- Context: ${ctx}`,
      `- Exact question: ${w.question}`,
      `- Answer: ${a.value.trim().replace(/\s*\n\s*/g, ' ')}`,
      `- Reuse scope: ${a.every ? 'broader context explicitly approved by the user' : 'exact context only'}`,
      '',
    ];
  };
  const jobs = [...new Set(got.map((w) => `${w.company} · ${w.title} · ${w.site}`))];
  return [
    'BEGIN NORTHLIST ANSWERS',
    '',
    '## form_answers.md: Learned Answers',
    ...got.filter((w) => answers[w.id].every).flatMap(record),
    '## form_answers.md: Contextual Answers',
    ...got.filter((w) => !answers[w.id].every).flatMap(record),
    '## Apply again',
    ...jobs.map((j) => `- ${j}`),
    '',
    'END NORTHLIST ANSWERS',
  ].join('\n');
}

/** Where this run's answers are kept in the browser: the same questions find their answers again. */
export const storageKey = (run: Run) =>
  `nl-apply-run:${run.date}:${run.waiting.map((w) => `${w.company}|${w.question}`).join('~')}`;

export const SAMPLE: Run = {
  mode: 'report',
  date: '2026-11-23',
  firstName: 'Asha',
  plan: [
    { site: 'LinkedIn', planned: 10, applied: 8 },
    { site: 'Naukri', planned: 10, applied: 9 },
    { site: 'Workday', planned: 2, applied: 1 },
  ],
  applied: (
    [
      ['Acme Cloud', 'Frontend Engineer', 'LinkedIn', '10:42'],
      ['Brightpath', 'React Developer', 'Naukri', '10:51'],
      ['Cobalt Labs', 'UI Engineer', 'Workday', '11:20'],
      ['Delta Health', 'Frontend Engineer', 'LinkedIn', '11:34'],
      ['Echo Pay', 'Senior Frontend Engineer', 'Naukri', '11:40'],
      ['Fernway', 'React Developer', 'Naukri', '11:52'],
      ['Gridline', 'Frontend Engineer', 'LinkedIn', '12:05'],
    ] as const
  ).map(([company, title, site, time]) => ({ company, title, site, time })),
  skipped: [
    { company: 'Sola', title: 'Senior Frontend Engineer', reason: 'Needs 8+ years' },
    { company: 'Tango', title: 'Frontend Engineer', reason: 'Office in Chennai' },
  ],
  waiting: [
    { id: 'w1', company: 'Nova Retail', title: 'Frontend Engineer', site: 'LinkedIn', question: 'Are you willing to work night shifts?', kind: 'yesno' },
    { id: 'w2', company: 'Nova Retail', title: 'Frontend Engineer', site: 'LinkedIn', question: 'How many years of experience do you have with Rust?', kind: 'number' },
    { id: 'w3', company: 'Uplift', title: 'React Developer', site: 'Workday', question: 'How did you hear about this job?', kind: 'choice', options: ['LinkedIn', 'Company website', 'Referral', 'Job board', 'Other'] },
    { id: 'w4', company: 'Vesta', title: 'UI Engineer', site: 'Naukri', question: 'Why do you want to join Vesta?', kind: 'text', draft: 'I have built React and TypeScript products for 6 years, most recently the customer dashboard at Brightwave Tech, and I like working closely with designers.' },
  ],
  stops: [{ site: 'Indeed', message: 'Too many requests' }],
  passedOver: 23,
  northlist: { connected: false, sent: 0 },
};
