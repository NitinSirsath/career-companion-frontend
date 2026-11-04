import { icon as I, wordmark } from '../parts/icons.ts';
import { needing, shownMails, TYPE, type Mail, type State } from './data.ts';
import { appCard, avatar, esc, fakeTag, mailCount, message, nextCard, reading, replyBox, statusTag, stepLine, synced } from './pieces.ts';

/* The example's laptop layout: side menu, top bar, and the Mails, mail, Applications and Dashboard pages. */

/** "Priya Nair · Brightwave · Interview · 2 mails" */
const metaLine = (m: Mail) => [m.from, m.company, TYPE[m.type][0], mailCount(m)].map(esc).join(' · ');

/** The application a mail belongs to: the company, then its status and job. */
function appCell(m: Mail): string {
  if (!m.app) return '<span class="sa-none">Not linked</span>';
  return `<span class="sa-co">${esc(m.company)}</span><span class="sa-appline">${statusTag(m.app.status)}<span>${esc(m.app.job)}</span></span>`;
}

function mailRow(m: Mail): string {
  return `
    <div class="sa-tr row${m.fresh ? ' sa-new' : ''}" data-open="${m.id}" tabindex="0">
      ${m.isNew ? '<i class="sa-dot" aria-label="New"></i>' : ''}${avatar(m.from)}
      <span class="sa-cell"><span class="sa-subj${m.isNew ? ' new' : ''}">${esc(m.subject)}</span>${stepLine(m, 'sa-step')}<span class="sa-meta">${metaLine(m)}</span></span>
      <span class="sa-cell${m.reading ? ' sa-wait' : ''}">${appCell(m)}</span>
      <span class="sa-date c-date">${m.date}</span>
    </div>`;
}

/** "3 mails need you. Everything else is up to date." The count turns the Needs action filter on and off. */
function summary(s: State): string {
  const n = needing(s).length;
  if (n === 0) return 'Nothing needs you right now. Everything is up to date.';
  return `<button type="button" class="sa-need" data-act="needs" aria-pressed="${s.needsOnly}">${n === 1 ? '1 mail needs you' : `${n} mails need you`}</button>. Everything else is up to date.`;
}

function mailsView(s: State): string {
  return `<div class="sa-page">
    <div class="sa-head"><div><h3 class="sa-h1">Mails</h3><p class="sa-sub">${summary(s)}</p></div>
      <div class="sa-sync"><span>${synced(s)}</span><button type="button" class="sa-btn" data-act="sync" ${s.syncing ? 'disabled' : ''}>${I('renew', 14, s.syncing ? 'spin' : '')} Sync now</button></div></div>
    <div class="sa-tabline">
      <div class="sa-tabs"><span class="on">Job mails <i>${s.mails.length}</i></span><span>Whole inbox</span><span class="c-hide">Restricted</span></div>
      <div class="sa-tools"><div class="sa-search">${I('search', 14)} Search mails</div><span class="sa-ghost">${I('filter', 14)} Filters</span><span class="sa-filter c-hide">Sort: Newest first ${I('chevronDown', 12)}</span></div>
    </div>
    <div class="sa-list" aria-label="Job mails">${shownMails(s).map(mailRow).join('')}</div>
  </div>`;
}

function mailView(s: State, m: Mail): string {
  return `<div class="sa-page">
    <div class="sa-head"><div><h3 class="sa-h1">${esc(m.subject)}</h3><div class="sa-tagrow">${m.app ? statusTag(m.app.status) : ''}${m.fake ? fakeTag : ''}<span class="sa-meta">${esc(m.company)} · ${mailCount(m)}</span></div></div>
      ${s.reply ? '' : `<button type="button" class="sa-btn pri" data-act="reply">${I('reply', 14)} Reply</button>`}</div>
    <div class="sa-conv"><div class="sa-thread">${m.thread.map(message).join('')}${s.reply ? replyBox(m, s.reply) : ''}</div>
      <div class="sa-cards">${nextCard(m)}${appCard(m)}</div></div>
  </div>`;
}

function appsView(s: State): string {
  const rows = s.apps
    .map(
      (a) => `
    <div class="sa-tr apps${a.mail ? ' row' : ''}" ${a.mail ? `data-open="${a.mail}" tabindex="0"` : ''}>
      <span class="sa-cell"><span class="sa-subj">${esc(a.co)}</span><span class="sa-meta">${esc(a.job)}</span></span>
      <span class="sa-cell">${statusTag(a.status)}</span>
      <span class="sa-cell">${a.todo ? `<span>${esc(a.todo)}</span><span class="sa-meta">${a.due}</span>` : '<span class="sa-meta">Nothing to do</span>'}</span>
      <span class="sa-cell c-date"><span class="sa-date">${a.applied}</span></span>
      <span class="sa-cell c-hide"><span class="sa-meta">${esc(a.last)}</span></span>
    </div>`,
    )
    .join('');
  return `<div class="sa-page">
    <div class="sa-head"><div><h3 class="sa-h1">Applications</h3><p class="sa-sub">Every job you applied for, where it stands, and what is next.</p></div></div>
    <div class="sa-seg"><span class="on">All</span><span>Applied</span><span>Recruiter contact</span><span>Assessment</span><span>Interview</span><span class="c-hide">Offer</span><span class="c-hide">Rejected</span></div>
    <div class="sa-atools"><div class="sa-search">${I('search', 14)} Search company or job title</div><span class="sa-filter c-hide">Sort: Newest added ${I('chevronDown', 12)}</span></div>
    <div class="sa-table" aria-label="Applications">
      <div class="sa-tr apps sa-th"><span>Company <span class="sa-count">${s.apps.length}</span></span><span>Status</span><span>To do</span><span class="c-date">Applied</span><span class="c-hide">Last activity</span></div>
      ${rows}
    </div>
  </div>`;
}

/** Twelve weekly bars, the last one full: how each number moved. */
const spark = (bars: number[]) =>
  `<span class="sa-spark" aria-hidden="true">${bars.map((h, i) => `<i class="${i === bars.length - 1 ? 'top' : ''}" style="height:${Math.max(2, h * 22)}px"></i>`).join('')}</span>`;

const STATS: [string, number, string, number[]][] = [
  ['Applications sent', 12, '↑ 3 vs the 30 days before', [0.2, 0.4, 0, 0.6, 0.4, 0.8, 0.2, 0.6, 1, 0.4, 0.6, 0.8]],
  ['Replies received', 7, '↑ 2 vs the 30 days before', [0, 0.2, 0.4, 0, 0.6, 0.2, 0.4, 0.8, 0.4, 0.6, 1, 0.6]],
  ['Interviews reached', 2, '↑ 1 vs the 30 days before', [0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0, 1]],
  ['Offers', 0, 'Same as the 30 days before', []],
  ['Rejections', 3, '↓ 1 vs the 30 days before', [0, 0.33, 0, 0, 0.33, 0, 0, 0.66, 0, 0, 0.33, 1]],
];

const STATS_HTML = `<div class="sa-stats">${STATS.map(
  ([k, v, d, bars]) => `<div class="sa-stat"><span class="k">${k}</span><span class="v">${v}</span>${v ? spark(bars) : '<span></span>'}<span class="d">${d}</span></div>`,
).join('')}</div>`;

/** A running total that climbs in steps over 30 days (made-up numbers). */
function line(points: number[], max: number): string {
  const step = 300 / (points.length - 1);
  return points.map((p, i) => `${(i * step).toFixed(1)},${(100 - (p / max) * 96).toFixed(1)}`).join(' ');
}
const SENT = [0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 8, 8, 9, 10, 11, 12];
const REPLIES = [0, 0, 0, 1, 1, 2, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7];
const INTERVIEWS = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
const CHART = `<div class="sa-panel sa-chart"><div class="bh"><span>Running total this period</span><span>Oct 5 to Nov 3</span></div>
  <div class="sa-legend"><span><i style="background:var(--chart-1)"></i>Applications sent</span><span><i style="background:var(--chart-2)"></i>Replies received</span><span><i style="background:var(--chart-3)"></i>Interviews reached</span></div>
  <svg class="sa-line" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
    <line class="grid" x1="0" y1="4" x2="300" y2="4"/><line class="grid" x1="0" y1="52" x2="300" y2="52"/><line class="grid" x1="0" y1="100" x2="300" y2="100"/>
    <polygon class="ar" fill="var(--chart-1)" points="0,100 ${line(SENT, 12)} 300,100"/>
    <polyline class="ln" stroke="var(--chart-1)" points="${line(SENT, 12)}"/>
    <polyline class="ln" stroke="var(--chart-2)" points="${line(REPLIES, 12)}"/>
    <polyline class="ln" stroke="var(--chart-3)" points="${line(INTERVIEWS, 12)}"/>
  </svg></div>`;

const STAGES: [string, number][] = [['Applied', 12], ['Got a reply', 7], ['Test or interview', 3], ['Offer', 0]];
const FUNNEL = `<div class="sa-two">
  <div class="sa-panel"><div class="sa-box"><div class="bh"><span>From applied to offer</span><span>12 applications</span></div></div>
    <div class="sa-funnel">${STAGES.map(([k, v]) => `<div><b>${v}</b><i style="height:${Math.max(2, (v / 12) * 80)}px"></i><span>${k}</span></div>`).join('')}</div></div>
  <div class="sa-panel"><div class="sa-box"><div class="bh"><span>Gone quiet</span><span>No news in 2 to 3 weeks</span></div></div>
    <div class="sa-quiet"><span><b>Halcyon</b><span class="sa-meta">UI Developer</span></span><span class="sa-meta">16 days</span></div></div>
</div>`;

interface NowCard {
  /** The page it opens, if any */
  go?: string;
  icon: string;
  title: string;
  value: number;
  note: string;
  /** The blue dot: something waits */
  dot?: boolean;
}

/** One "Needs you now" panel. */
function nowCard({ go, icon: ic, title: k, value: v, note: d, dot = false }: NowCard): string {
  const tag = go ? `button type="button" data-go="${go}"` : 'div';
  const arrow = go ? `<span class="arr">${I('arrowRight', 14)}</span>` : '<span></span>';
  return `<${tag} class="sa-panel"><span class="k">${I(ic, 14)} ${k}${dot ? '<i class="sa-dot"></i>' : ''}</span>${arrow}<b>${v}</b><span class="d">${d}</span></${go ? 'button' : 'div'}>`;
}

/** The Dashboard page, as in the app; the phone layout shows the same page without its outer frame. */
export function dashView(s: State): string {
  const open = needing(s).length;
  const fresh = s.mails.filter((m) => m.isNew).length;
  return `<div class="sa-page">
    <div class="sa-head"><div><h3 class="sa-h1">Good morning, Alex</h3><p class="sa-sub">Your job search, from your mails since Oct 1</p></div></div>
    <h4 class="sa-sec">Needs you now</h4>
    <div class="sa-now">
      ${nowCard({ go: 'mails', icon: 'mail', title: 'New job mails', value: fresh, note: fresh ? 'Open them on Mails' : 'You have opened every job mail' })}
      ${nowCard({ go: 'mails', icon: 'doc', title: 'Needs action', value: open, note: 'Answer them, or mark them done', dot: open > 0 })}
      ${nowCard({ icon: 'calendar', title: 'Interviews coming up', value: 0, note: 'No interviews booked yet' })}
    </div>
    <div class="sa-sechead"><h4 class="sa-sec">Your progress</h4><span class="sa-filter">Last 30 days ${I('chevronDown', 12)}</span></div>
    ${STATS_HTML}
    ${CHART}
    ${FUNNEL}
  </div>`;
}

const TITLE = { dashboard: 'Dashboard', mails: 'Mails', applications: 'Applications', mail: 'Mails' };
const CRUMB_ICON = { dashboard: 'dashboard', mails: 'mail', mail: 'mail', applications: 'doc' };

/** The whole laptop layout for the current state. */
export function laptop(s: State, m: Mail | null): string {
  const title = TITLE[s.view];
  const crumb = m
    ? `<button type="button" data-act="back">${I('mail', 14)} Mails</button><span class="sep">${I('chevronRight', 12)}</span><span class="cur">${esc(m.company)}</span>`
    : `${I(CRUMB_ICON[s.view], 14)}<span class="cur">${title}</span>`;
  const nav = (v: string, ic: string, label: string) =>
    `<button type="button" class="sa-nav${title === label ? ' on' : ''}" data-go="${v}" title="${label}">${I(ic, 16)} <span class="lbl">${label}</span></button>`;
  const soon = (ic: string, label: string) =>
    `<button type="button" class="sa-nav" data-soon title="${label}">${I(ic, 16)} <span class="lbl">${label}</span></button>`;
  const view = m ? mailView(s, m) : { mails: mailsView, applications: appsView, dashboard: dashView, mail: mailsView }[s.view](s);
  return `<div class="sa-grid">
    <div class="sa-brand">${wordmark(17)}</div>
    <div class="sa-top"><div class="sa-crumb">${crumb}</div><div class="sa-top-right"><span><span class="sa-avatar">A</span></span></div></div>
    <aside class="sa-side" aria-label="Sample app menu">${nav('dashboard', 'dashboard', 'Dashboard')}${nav('mails', 'mail', 'Mails')}${nav('applications', 'doc', 'Applications')}
      <span class="sa-group">Settings</span>${soon('renew', 'Gmail sync')}${soon('model', 'AI providers')}${soon('flow', 'Automation')}${reading(s)}</aside>
    <div class="sa-main">${view}</div>
  </div>`;
}
