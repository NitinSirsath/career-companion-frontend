import { icon as I, wordmark } from '../parts/icons.ts';
import type { Mail, State } from './data.ts';
import { appCard, esc, fakeTag, message, nextCard, reading, replyBox, statusTag, stepCell, synced, type } from './pieces.ts';

/* The example's laptop layout: side menu, top bar, and the Mails, mail, Applications and Dashboard pages. */

function mailRow(m: Mail): string {
  const wait = m.reading ? ' sa-wait' : '';
  const app = m.app
    ? `<span class="sa-co">${esc(m.company)}</span><span class="sa-meta">${esc(m.app.job)}</span>${statusTag(m.app.status)}`
    : '<span class="sa-meta">Not linked</span>';
  return `
    <div class="sa-tr row${m.fresh ? ' sa-new' : ''}" data-open="${m.id}" tabindex="0">
      <span>${m.isNew ? '<i class="sa-dot"></i>' : ''}</span>
      <span class="sa-cell"><span class="sa-subj${m.isNew ? ' new' : ''}">${esc(m.subject)}</span><span class="sa-meta">${esc(m.from)} · ${esc(m.company)} · ${m.thread.length} mail${m.thread.length > 1 ? 's' : ''}</span></span>
      <span class="sa-cell c-type${wait}">${type(m)}${m.fake ? fakeTag : ''}</span>
      <span class="sa-cell">${stepCell(m)}</span>
      <span class="sa-cell${wait}">${app}</span>
      <span class="sa-date c-date">${m.date}</span>
    </div>`;
}

function mailsView(s: State): string {
  return `<div class="sa-page">
    <div class="sa-head"><div><h3 class="sa-h1">Mails</h3><p class="sa-sub">Every job mail, what it needs from you, and the application it belongs to.</p></div>
      <div class="sa-sync"><span>${synced(s)}</span><button type="button" class="sa-btn" data-act="sync" ${s.syncing ? 'disabled' : ''}>${I('renew', 14, s.syncing ? 'spin' : '')} Sync now</button></div></div>
    <div class="sa-tabs"><span class="on">Job mails (${s.mails.length})</span><span>Whole inbox</span><span>Restricted</span></div>
    <div class="sa-tools"><div class="sa-search">${I('search', 14)} Search company, role, sender or subject</div><span class="sa-filter">Action: All ${I('chevronDown', 12)}</span><span class="sa-filter c-hide">Type: All ${I('chevronDown', 12)}</span><span class="sa-filter c-hide">Sort: Needs action first ${I('chevronDown', 12)}</span></div>
    <div class="sa-table" aria-label="Job mails">
      <div class="sa-tr sa-th"><span></span><span>Mail <span class="sa-count">${s.mails.length}</span></span><span class="c-type">Type</span><span>Next step</span><span>Application</span><span class="c-date">Last mail</span></div>
      ${s.mails.map(mailRow).join('')}
    </div>
  </div>`;
}

function mailView(s: State, m: Mail): string {
  return `<div class="sa-page">
    <div class="sa-head"><div><h3 class="sa-h1">${esc(m.subject)}</h3><div class="sa-tagrow">${m.app ? statusTag(m.app.status) : ''}${m.fake ? fakeTag : ''}</div></div>
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
    <div class="sa-tabs"><span class="on">All</span><span>Applied</span><span>Recruiter contact</span><span>Assessment</span><span>Interview</span><span class="c-hide">Offer</span><span class="c-hide">Rejected</span></div>
    <div class="sa-tools"><div class="sa-search">${I('search', 14)} Search company or job title</div><span class="sa-filter c-hide">Sort: Newest added ${I('chevronDown', 12)}</span></div>
    <div class="sa-table" aria-label="Applications">
      <div class="sa-tr apps sa-th"><span>Company <span class="sa-count">${s.apps.length}</span></span><span>Status</span><span>To do</span><span class="c-date">Applied</span><span class="c-hide">Last activity</span></div>
      ${rows}
    </div>
  </div>`;
}

const STATS = `<div class="sa-stats">
  <div class="sa-stat"><span class="k">Applications sent</span><span class="v">12</span><span class="d">↑ 3 vs the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Replies received</span><span class="v">7</span><span class="d">↑ 2 vs the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Interviews reached</span><span class="v">2</span><span class="d">↑ 1 vs the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Offers</span><span class="v">0</span><span class="d">Same as the 30 days before</span></div>
  <div class="sa-stat"><span class="k">Rejections</span><span class="v">3</span><span class="d">↓ 1 vs the 30 days before</span></div>
</div>`;

const CHARTS = `<div class="sa-box"><div class="bh"><span>Right now: 8 active jobs</span><button type="button" data-go="applications">Open Applications</button></div>
  <div class="sa-bar"><i style="width:50%;background:var(--chart-4)"></i><i style="width:25%;background:#002d9c"></i><i style="width:12.5%;background:var(--chart-2)"></i><i style="width:12.5%;background:var(--chart-1)"></i></div>
  <div class="sa-legend"><div><span><i style="background:var(--chart-4)"></i>Applied</span><b>4</b></div><div><span><i style="background:#002d9c"></i>Recruiter contact</span><b>2</b></div><div><span><i style="background:var(--chart-2)"></i>Assessment</span><b>1</b></div><div><span><i style="background:var(--chart-1)"></i>Interview</span><b>1</b></div><div><span><i style="background:var(--ok)"></i>Offer</span><b>0</b></div></div></div>
<div class="sa-two">
  <div class="sa-box"><div class="bh"><span>From applied to offer</span></div><div class="sa-hbars">
    <div><span>Applied</span><span class="tr"><i style="width:100%"></i></span><b>12</b></div><div><span>Got a reply</span><span class="tr"><i style="width:58%"></i></span><b>7</b></div><div><span>Test or interview</span><span class="tr"><i style="width:25%"></i></span><b>3</b></div><div><span>Offer</span><span class="tr"><i style="width:0%"></i></span><b>0</b></div></div></div>
  <div class="sa-box"><div class="bh"><span>Where rejected jobs ended</span></div><div class="sa-hbars">
    <div><span>Before any reply</span><span class="tr"><i style="width:66%;background:var(--chart-5)"></i></span><b>2</b></div><div><span>After a test</span><span class="tr"><i style="width:33%;background:var(--chart-5)"></i></span><b>1</b></div><div><span>After an interview</span><span class="tr"><i style="width:0%"></i></span><b>0</b></div></div></div>
</div>`;

/** The Dashboard page; the phone layout shows the same page without its outer frame. */
export function dashView(s: State): string {
  const open = s.mails.filter((m) => m.state === 'OPEN' && !m.fake).length;
  return `<div class="sa-page">
    <div class="sa-head"><div><h3 class="sa-h1">Dashboard</h3><p class="sa-sub">Your job search in numbers, from your mails since Oct 1, 2026.</p></div><span class="sa-filter">Last 30 days ${I('chevronDown', 12)}</span></div>
    <div class="sa-strip"><span>${14 + Number(s.synced)} job mails read</span><span>·</span><span>1 fake offer caught</span></div>
    <div class="sa-tips">
      <div>${I('bulb', 14)} <span>${open} mail${open === 1 ? '' : 's'} need${open === 1 ? 's' : ''} something from you. <button type="button" data-go="mails">Open them</button></span></div>
      <div>${I('bulb', 14)} <span>Tip: you reply to recruiters within a day. Keep it up.</span></div>
    </div>
    ${STATS}
    ${CHARTS}
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
