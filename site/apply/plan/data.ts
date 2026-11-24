/*
 * "What should I apply to today?" of NorthList Apply (instructions/plan_page.md): the facts the AI writes
 * after "#", the limits, and the plan the AI reads back. Plain functions, no page: the tests use them.
 *
 * Facts, all optional:
 *   last         the last plan, "linkedin 10, naukri 2" (what `same` means today)
 *   today        sent so far today per plan item, "linkedin 4"; numbers are then today's totals
 *   limits       lower daily limits from profile.md, "linkedin 15"
 *   careerPages  false when profile.md has no career page addresses
 *   hours        the session limit in hours (default 4)
 */
export type Counts = Record<string, number>;
export interface Facts {
  last: Counts;
  today: Counts;
  limits: Counts;
  careerPages: boolean;
  hours: number;
}
export interface Item {
  key: string;
  name: string;
  max: number;
}
export interface Group {
  title: string;
  hint: string;
  minutes: number;
  items: Item[];
}

/** The daily maximums of AGENTS.md section 5. Job sources fill company sites, so 10 each here. */
export const GROUPS: Group[] = [
  {
    title: 'Quick apply',
    hint: 'about 4 min a job',
    minutes: 4,
    items: [
      { key: 'linkedin', name: 'LinkedIn', max: 20 },
      { key: 'naukri', name: 'Naukri', max: 25 },
      { key: 'indeed', name: 'Indeed', max: 20 },
      { key: 'wellfound', name: 'Wellfound', max: 10 },
      { key: 'instahyre', name: 'Instahyre', max: 10 },
    ],
  },
  {
    title: 'Company sites',
    hint: 'an account per company · about 8 min a job',
    minutes: 8,
    items: [
      { key: 'workday', name: 'Workday', max: 5 },
      { key: 'company_direct', name: 'Your career pages', max: 10 },
      { key: 'discovery', name: 'Web search', max: 10 },
    ],
  },
  {
    title: 'Job sources',
    hint: 'each job on its company’s site · about 8 min',
    minutes: 8,
    items: [
      { key: 'the_reliable_jobs', name: 'The Reliable Jobs', max: 10 },
      { key: 'teksystems', name: 'TEKsystems', max: 10 },
      { key: 'teksands', name: 'Teksands', max: 10 },
      { key: 'd4hire', name: 'D4Hire', max: 10 },
      { key: 'supersourcing', name: 'Supersourcing', max: 10 },
    ],
  },
];
/** Career pages and web search share 10 a day; all sites together 50. */
export const SHARED = ['company_direct', 'discovery'];
export const SHARED_MAX = 10;
export const TOTAL_MAX = 50;

const ALL = GROUPS.flatMap((g) => g.items);
const KEYS = new Set(ALL.map((i) => i.key));
const MINUTES: Counts = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.key, g.minutes])));
export const itemName = (key: string) => ALL.find((i) => i.key === key)?.name ?? key;

/** "linkedin 10, naukri 2" or { linkedin: 10 } → counts of known plan items, in that order. */
function pairsOf(v: unknown): [string, unknown][] {
  if (typeof v === 'string')
    return v.split(',').map((part) => {
      const m = /^\s*([a-z_]+)\s*[:=]?\s*(\d+)\s*$/i.exec(part);
      return m ? [m[1], m[2]] : ['', 0];
    });
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.entries(v);
  return [];
}

export function readCounts(v: unknown): Counts {
  const out: Counts = {};
  for (const [raw, n] of pairsOf(v)) {
    const key = raw.trim().toLowerCase();
    const num = Math.round(Number(n));
    if (KEYS.has(key) && Number.isFinite(num) && num >= 0 && !(key in out)) out[key] = num;
  }
  return out;
}

/** The facts after "#". Anything unreadable leaves the page with no last plan, never broken. */
export function readFacts(hash: string): Facts {
  let raw: Record<string, unknown> = {};
  try {
    const text = decodeURIComponent(hash.replace(/^#/, ''));
    if (text.trim()) raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const hours = Number(raw.hours);
  return {
    last: readCounts(raw.last),
    today: readCounts(raw.today),
    limits: readCounts(raw.limits),
    careerPages: raw.careerPages !== false,
    hours: Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : 4,
  };
}

/** The groups the user sees: no career pages without their addresses. */
export const groupsFor = (facts: Facts): Group[] =>
  GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.key !== 'company_direct' || facts.careerPages),
  }));

/** The most this plan item can take now: its daily maximum, a lower limit, the shared 10, the 50. */
export function capOf(key: string, picks: Counts, facts: Facts): number {
  const item = ALL.find((i) => i.key === key);
  if (!item) return 0;
  let cap = Math.min(item.max, facts.limits[key] ?? item.max);
  const others = (keys: string[]) =>
    keys.filter((k) => k !== key).reduce((n, k) => n + (picks[k] ?? 0), 0);
  if (SHARED.includes(key)) cap = Math.min(cap, SHARED_MAX - others(SHARED));
  cap = Math.min(cap, TOTAL_MAX - others(Object.keys(picks)));
  return Math.max(0, cap);
}

/** The lowest number a plan item can have today: what was already sent, or 1 while picked. */
export const floorOf = (key: string, facts: Facts) => Math.max(1, facts.today[key] ?? 0);

/** The last plan, kept inside today's limits: where the page starts. */
export function startPicks(facts: Facts): Counts {
  const picks: Counts = {};
  const shown = new Set(groupsFor(facts).flatMap((g) => g.items.map((i) => i.key)));
  for (const [key, n] of Object.entries(facts.last)) {
    if (!shown.has(key)) continue;
    const value = Math.min(n, capOf(key, picks, facts));
    if (value > 0) picks[key] = Math.max(value, facts.today[key] ?? 0);
  }
  // A site with jobs sent today stays in the plan.
  for (const [key, sent] of Object.entries(facts.today))
    if (sent > 0 && !(key in picks) && shown.has(key)) picks[key] = sent;
  return picks;
}

/** What a newly picked plan item starts at: its last number, else 10 (quick apply) or 2. */
export function firstNumber(key: string, picks: Counts, facts: Facts): number {
  const wish = facts.last[key] || (MINUTES[key] === 4 ? 10 : 2);
  return Math.min(Math.max(wish, facts.today[key] ?? 0), capOf(key, picks, facts));
}

/** The plan as the AI writes it in the chat, in the page's order: "linkedin 10, workday 2". */
export function planText(picks: Counts): string {
  return ALL.filter((i) => (picks[i.key] ?? 0) > 0)
    .map((i) => `${i.key} ${picks[i.key]}`)
    .join(', ');
}

/** The plan in the user's words: "LinkedIn 10, Workday 2". */
export const planWords = (counts: Counts) =>
  ALL.filter((i) => (counts[i.key] ?? 0) > 0)
    .map((i) => `${i.name} ${counts[i.key]}`)
    .join(', ');

/** Jobs left to apply to today and a rough time for them. */
export function estimate(picks: Counts, facts: Facts) {
  let jobs = 0;
  let left = 0;
  let minutes = 0;
  for (const [key, n] of Object.entries(picks)) {
    const rest = Math.max(0, n - (facts.today[key] ?? 0));
    jobs += n;
    left += rest;
    minutes += rest * (MINUTES[key] ?? 8);
  }
  return { jobs, left, minutes, tooLong: minutes > facts.hours * 60 };
}

/** "about 1 h 10 min": rounded to 5 minutes, never below 5. */
export function roughTime(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The block the AI reads back. */
export const planBlock = (picks: Counts) =>
  ['BEGIN NORTHLIST PLAN', planText(picks), 'END NORTHLIST PLAN'].join('\n');

/** Where this start's picks are kept in the browser: the same facts find them again. */
export const storageKey = (facts: Facts) =>
  `nl-apply-plan:${planText(facts.last)}|${planText(facts.today)}`;

/** `?demo` samples, for trying the page without an AI. */
export const SAMPLES: Record<string, Record<string, unknown>> = {
  last: { last: 'linkedin 10, naukri 2', hours: 4 },
  today: { last: 'linkedin 10, naukri 2', today: 'linkedin 4', hours: 4 },
  first: { hours: 4 },
  small: { last: 'linkedin 10, workday 2', careerPages: false, limits: 'linkedin 15', hours: 4 },
};
