/*
 * The NorthList step's picture (owner, 24 Nov 2026): a small working copy of NorthList instead of a list of
 * claims. Jobs land in the list while "Your AI is applying now" runs and the count goes up; the user can pick
 * a site, tap a job to see what the AI sent and the company's reply, and tap the phone alert to open that job.
 * All of it is sample data drawn here: nothing is loaded and nothing is sent.
 */
import { esc } from './data.ts';

interface App {
  co: string;
  role: string;
  site: string;
  ring: '' | 'half' | 'full';
  st: string;
  sent: [string, string][];
  reply?: [string, string];
}

const APPS: App[] = [
  {
    co: 'Acme Cloud',
    role: 'Frontend Engineer',
    site: 'LinkedIn',
    ring: 'full',
    st: 'Interview, Thu 11:00',
    sent: [['Notice', '30 days'], ['Expected pay', '₹24 lakh a year'], ['React', '5 years']],
    reply: ['Priya, Acme Cloud · Tue', 'We would like to invite you for an interview on Thursday at 11:00.'],
  },
  {
    co: 'Brightpath',
    role: 'React Developer',
    site: 'Naukri',
    ring: 'half',
    st: 'Replied 2 h ago',
    sent: [['Notice', '30 days'], ['Work mode', 'Hybrid, Pune'], ['Why us', 'Two lines from your profile']],
    reply: ['Rahul, Brightpath · 2 h ago', 'Thanks for applying. Can we talk on Thursday?'],
  },
  { co: 'Cobalt Labs', role: 'UI Engineer', site: 'Workday', ring: '', st: 'Applied today', sent: [['Notice', '30 days'], ['Visa needed', 'No'], ['Portal account', 'Saved: sign in from NorthList']] },
  { co: 'Echo Pay', role: 'Senior Frontend', site: 'LinkedIn', ring: '', st: 'Applied yesterday', sent: [['Notice', '30 days'], ['TypeScript', '4 years']] },
];
const QUEUE: Pick<App, 'co' | 'role' | 'site'>[] = [
  { co: 'Delta Health', role: 'Frontend Engineer', site: 'LinkedIn' },
  { co: 'Fernhill', role: 'React Developer', site: 'Naukri' },
  { co: 'Glasswing', role: 'UI Engineer', site: 'Workday' },
];
const TABS = ['All', 'LinkedIn', 'Naukri', 'Workday'];

/* NorthList's own mark (the Horizon: a half sun over a list) and its name with the mark as the "o": the same
   shapes as src/components/layout/Logo.tsx. The mark keeps the brand colour; everything else stays grey. */
const MARK = 'M2 16A14 14 0 0 1 30 16ZM2.144 18H22A2 2 0 0 1 22 22H3.351A14 14 0 0 1 2.144 18ZM4.511 24H15.5A2 2 0 0 1 15.5 28H8.789A14 14 0 0 1 4.511 24Z';
const mark = (cls = 'nl-mark') => `<svg class="${cls}" viewBox="2 2 28 28" aria-hidden="true"><path d="${MARK}"/></svg>`;
const wordmark = `<span class="nl-word" role="img" aria-label="NorthList"><span aria-hidden="true">n</span>${mark()}<span aria-hidden="true">rthlist</span></span>`;

/* The phone: an iPhone drawn at its real proportions (the site's phone frame, made small), on its lock screen. */
const PH = {
  signal: '<svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>',
  wifi: '<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.1-1.2A10.3 10.3 0 0 0 8 1 10.3 10.3 0 0 0 .9 3.8L2 5a8.7 8.7 0 0 1 6-2.4Zm0 3.3c1.4 0 2.700.5 3.700 1.400l1.100-1.200A7.100 7.100 0 0 0 8 4.300a7.100 7.100 0 0 0-4.800 1.800l1.100 1.200A5.500 5.500 0 0 1 8 5.900Zm0 3.200c.7 0 1.300.2 1.800.7L8 11.900 6.200 9.800c.5-.5 1.100-.7 1.800-.7Z"/></svg>',
  battery: '<svg viewBox="0 0 27 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.9"/><path d="M24.5 4v4c.9-.3 1.500-1.100 1.500-2s-.6-1.700-1.500-2Z" opacity=".45"/></svg>',
  lock: '<svg viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="1" y="8" width="12" height="9" rx="2.5" fill="currentColor" stroke="none"/><path d="M3.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  torch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M8 2h8v4l-2 4v12h-4V10L8 6z"/><path d="M12 13v3"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3.5l2-3h7l2 3H21v11H3z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/></svg>',
};
interface Notice {
  icon: string;
  app: string;
  when: string;
  title: string;
  body: string;
}
const notice = (n: Notice) =>
  `<span class="ph-ic">${n.icon}</span><span class="ph-tx"><span class="ph-h"><b>${n.title}</b><em>${n.when}</em></span><span class="ph-b">${n.body}</span><span class="ph-a">${n.app}</span></span>`;
const phone = `<div class="nl-phone" aria-label="NorthList on your phone">
      <i class="ph-btn l a"></i><i class="ph-btn l u"></i><i class="ph-btn l d"></i><i class="ph-btn r p"></i>
      <div class="ph-body"><div class="ph-screen">
        <span class="ph-cut"></span>
        <div class="ph-status"><b>9:41</b><span></span><span class="ph-icons">${PH.signal}${PH.wifi}${PH.battery}</span></div>
        <span class="ph-lock">${PH.lock}</span>
        <p class="ph-date">Tuesday, 24 November</p>
        <p class="ph-time">9:41</p>
        <div class="ph-widgets"><span class="w-rect"><span class="w-ic">${PH.sun}</span><span><b>Sunny</b><em>H:29° L:18°</em></span></span><span class="w-ring" style="--p:86"><b>86</b><em>%</em></span><span class="w-ring" style="--p:62"><b>24°</b></span></div>
        <div class="ph-stack" id="nl-push"><div class="ph-n old">${notice({ icon: PH.mail, app: 'Gmail', when: '9:38', title: 'Rahul, Brightpath', body: 'Re: your React Developer application' })}</div><span class="ph-more"></span></div>
        <div class="ph-keys"><span>${PH.torch}</span><span>${PH.cam}</span></div>
        <span class="ph-home"></span>
      </div></div>
    </div>`;
const START = 42;

const N = { tab: 'All', open: -1, rows: [] as App[], count: START, run: 0 };
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);

function rowHtml(a: App, i: number, fresh: boolean): string {
  const hidden = N.tab !== 'All' && a.site !== N.tab ? ' hidden' : '';
  const sent = a.sent.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  const reply = a.reply ? `<div class="reply"><small>${esc(a.reply[0])}</small>${esc(a.reply[1])}</div>` : '';
  return `<li${fresh ? ' class="new"' : ''}${hidden}>
    <button type="button" class="nl-row" data-nl-row="${i}" aria-expanded="${N.open === i}"><i class="ring ${a.ring}"></i><span class="who"><b>${esc(a.co)}</b> <span>· ${esc(a.role)} · ${esc(a.site)}</span></span><span class="st">${esc(a.st)}</span><span class="chev">›</span></button>
    <div class="nl-more"><div><dl>${sent}${reply}</dl></div></div></li>`;
}
function drawRows(fresh = -1) {
  const list = $('#nl-rows');
  if (list) list.innerHTML = N.rows.map((a, i) => rowHtml(a, i, i === fresh)).join('');
}
const setTab = (tab: string) => {
  N.tab = tab;
  document.querySelectorAll<HTMLElement>('[data-nl-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.nlTab === tab)));
};

/** The picture's HTML; `play()` fills it and starts it. */
export function picture(): string {
  const tabs = TABS.map((t) => `<button type="button" data-nl-tab="${t}" aria-pressed="${t === 'All'}">${t}</button>`).join('');
  return `<div class="nl">
    <div class="nl-app">
      <div class="nl-head">${wordmark}<span class="nl-nav"><span>Mails</span><span class="on">Applications</span><span>Today</span></span><span class="nl-me">AR</span></div>
      <div class="nl-bar"><b>Applications</b><span class="nl-tabs">${tabs}</span><span class="nl-count"><output id="nl-n">${START}</output> since yesterday</span></div>
      <div class="nl-live" id="nl-live-row"><i></i><span id="nl-live">Your AI is applying now</span><span class="nl-prog"><b id="nl-prog"></b></span></div>
      <ul class="nl-rows" id="nl-rows"></ul>
    </div>
    ${phone}
  </div>`;
}

/** Start the picture: three jobs are applied to, one after the other, then it rests. Only new data moves. */
export function play() {
  const run = (N.run += 1);
  Object.assign(N, { tab: 'All', open: -1, rows: APPS.map((a) => ({ ...a })), count: START });
  drawRows();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gone = () => run !== N.run || !$('#nl-live');
  const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, still ? 0 : ms));
  void (async () => {
    for (const [n, job] of QUEUE.entries()) {
      for (let k = 1; k <= 5; k += 1) {
        if (gone()) return;
        ($('#nl-live') as HTMLElement).textContent = `Your AI is applying now · ${job.co} · form step ${k} of 5`;
        ($('#nl-prog') as HTMLElement).style.width = `${k * 20}%`;
        await wait(650);
      }
      if (gone()) return;
      N.rows.unshift({ ...job, ring: '', st: 'Applied just now', sent: [['Notice', '30 days'], ['Answers', 'All from your profile']] });
      if (N.open >= 0) N.open += 1;
      N.count += 1;
      drawRows(0);
      const out = $('#nl-n');
      if (out) {
        out.textContent = String(N.count);
        out.classList.remove('tick');
        void out.offsetWidth; // start the small roll again
        out.classList.add('tick');
      }
      ($('#nl-prog') as HTMLElement).style.width = '0%';
      if (n === 0)
        $('#nl-push')?.insertAdjacentHTML(
          'afterbegin',
          `<button type="button" class="ph-n push" data-nl-open="Brightpath">${notice({ icon: mark('nl-mark app'), app: 'NorthList', when: 'now', title: 'Brightpath replied', body: 'Can we talk on Thursday? Tap to open.' })}</button>`,
        );
      await wait(900);
    }
    if (gone()) return;
    $('#nl-live-row')?.classList.add('idle');
    ($('#nl-live') as HTMLElement).textContent = `Today's run is done · ${QUEUE.length} applied, 0 waiting for you`;
  })();
}

/** A click inside the picture: a site, a job, or the phone alert. True when it was one of them. */
export function pictureClick(t: HTMLElement): boolean {
  if (t.dataset.nlTab) {
    setTab(t.dataset.nlTab);
    drawRows();
    return true;
  }
  if (t.dataset.nlRow) {
    const i = Number(t.dataset.nlRow);
    N.open = N.open === i ? -1 : i;
    document.querySelectorAll<HTMLElement>('.nl-row').forEach((b) => b.setAttribute('aria-expanded', String(Number(b.dataset.nlRow) === N.open)));
    return true;
  }
  if (t.dataset.nlOpen) {
    setTab('All');
    N.open = N.rows.findIndex((r) => r.co === t.dataset.nlOpen);
    drawRows();
    return true;
  }
  return false;
}
