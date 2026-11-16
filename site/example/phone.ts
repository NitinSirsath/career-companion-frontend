import { appIcon as I, tabIcon } from '../parts/appIcons.ts';
import { needing, shownMails, TYPE, type Mail, type State } from './data.ts';
import { PROGRESS } from './laptop.ts';
import {
  aiHelp,
  asking,
  asksNothing,
  avatar,
  esc,
  fakeTag,
  mailCount,
  replyBody,
  sendButton,
  state,
  statusTag,
  stepLine,
  summary,
  TEXT_TOOLS,
} from './pieces.ts';

/*
 * The example's phone layout, as the app looks on a phone since the new look (owner, 13 Nov 2026,
 * approved mock IOS-LOOK-mock/): round glass buttons over the page instead of a top bar, big titles,
 * mails edge to edge in four short lines, a floating glass tab bar with four tabs, a floating action
 * bar on a mail, and sheets that rise over the page while it shrinks a little behind them.
 */

/** How the page came in: slid in from the right (a mail opened), back from the left, or a sheet rose. */
export type Enter = '' | 'push' | 'pop' | 'sheet';

/** A round glass button over the page. */
const glassBtn = (attrs: string, ic: string, label: string) =>
  `<button type="button" class="sa-gbtn glass" ${attrs} aria-label="${label}">${I(ic, 24)}</button>`;

/** Refresh, search and filters in one glass capsule, as on the app's lists. */
function capsule(s: State, mails: boolean): string {
  const filters = mails
    ? `data-menu="filters" aria-expanded="${s.menu === 'filters'}"`
    : 'data-soon="Filters are in the real app, not in this example"';
  return `<div class="sa-cap glass" role="group" aria-label="List tools">
    <button type="button" data-act="sync" aria-label="Refresh" ${s.syncing ? 'disabled' : ''}>${I('renew', 22, s.syncing ? 'spin' : '')}</button>
    <button type="button" data-soon="Search is in the real app, not in this example" aria-label="Search">${I('search', 22)}</button>
    <button type="button" ${filters} aria-label="Filters">${I('filter', 22)}</button>
  </div>`;
}

/** "Synced 9:40 AM", then what the AI is doing, as under the app's Mails title. */
function statusLine(s: State): string {
  if (s.syncing) return 'Syncing…';
  const when = s.syncedAt === 'just now' ? 'just now' : s.syncedAt;
  if (s.reading) return `Synced ${when} · <span class="shimmer">Reading your new mails · 0 of 1</span>`;
  if (s.synced) return `Synced ${when} · Done reading your new mails`;
  return `Synced ${when}`;
}

/** The fourth line of a mail: the application's status and company (or the mail's type), and the step's state. */
function tagLine(m: Mail): string {
  // The company stands out a little from the rest of the line (owner, 16 Nov 2026).
  const where = m.app ? `<span class="co">${esc(m.company)}</span>` : `${TYPE[m.type][0]} · Not linked`;
  let detail = '';
  if (m.state === 'REPLIED' && m.repliedAt) detail = `You replied ${m.repliedAt.replace(/,.*$/, '')}`;
  else if (m.state === 'DONE' && m.closed) detail = m.closed;
  else if (m.state === 'OPEN' && m.due) detail = m.due.replace(/^By /, 'Due ');
  return `<span class="tg${m.reading ? ' sa-wait' : ''}">${m.app ? statusTag(m.app.status) : ''}${m.fake ? fakeTag : ''}<span class="w">${where}${detail ? ` · ${detail}` : ''}</span></span>`;
}

/** A mail's date as the app writes it on phones: "Today, 9:12 AM" for today's mails. */
function rowDate(date: string): string {
  if (date === 'Just now') return 'Today, 9:41 AM';
  return /^\d/.test(date) ? `Today, ${date}` : date;
}

/** One mail, as in the app on a phone: who and when, the subject, the next step, the application. */
function mailRow(m: Mail): string {
  return `<div class="sa-mrow${m.fresh ? ' sa-new' : ''}${m.state === 'DONE' && !asksNothing(m) ? ' done' : ''}" data-open="${m.id}" tabindex="0" role="button" aria-label="${esc(m.subject)}, from ${esc(m.from)}">
    ${m.isNew ? '<i class="sa-ndot" aria-label="New"></i>' : ''}
    <span class="c"><span class="t"><b>${esc(m.from)}</b><span class="dt">${rowDate(m.date)}${I('chevronRight', 15)}</span></span>
    <span class="s">${esc(m.subject)}</span>${stepLine(m, 'st', 15)}${tagLine(m)}</span></div>`;
}

/** The filters in use, as small pills under the title; × takes one off. */
function pills(s: State): string {
  const pill = (act: string, label: string) =>
    `<button type="button" class="sa-fpill" data-act="${act}" aria-label="Remove filter: ${label}">${label}${I('close', 14)}</button>`;
  const on = [s.needsOnly && pill('needs', 'Needs action'), s.newOnly && pill('new', 'New only')].filter(Boolean);
  return on.length ? `<div class="sa-fpills">${on.join('')}</div>` : '';
}

function mailsPage(s: State): string {
  const rows = shownMails(s);
  return `<div class="sa-lt"><h3 class="sa-big" tabindex="-1"><button type="button" class="sa-titlebtn" data-soon="Whole inbox and Restricted are in the real app, not in this example">Job mails${I('chevronDown', 22)}</button></h3>
    <p class="sa-status">${statusLine(s)}</p>${pills(s)}</div>
    <div class="sa-rows">${rows.map(mailRow).join('') || '<p class="sa-empty">No mails match these filters.</p>'}</div>
    <p class="sa-pfoot">${summary(needing(s).length, s.needsOnly)}</p>`;
}

function appsPage(s: State): string {
  const rows = s.apps
    .map((a) => {
      const open = a.mail ? `data-open="${a.mail}" tabindex="0" role="button"` : '';
      const todo = a.todo ? '<span class="tag tag-yellow">1 to do</span>' : '';
      return `<div class="sa-arow" ${open}><span class="c"><span class="t"><b>${esc(a.co)}</b>${statusTag(a.status)}</span><span class="j">${esc(a.job)}</span><span class="n">${todo}<span class="w">${esc(a.last)}</span></span></span>${I('chevronRight', 18, 'chev')}</div>`;
    })
    .join('');
  return `<div class="sa-lt"><h3 class="sa-big" tabindex="-1">Applications</h3></div>
    <div class="sa-seg" role="group" aria-label="Lists"><span class="on">In progress <small>${s.apps.length}</small></span><button type="button" data-soon="NorthList Apply is in the real app, not in this example">NorthList Apply</button></div>
    <div class="sa-group">${rows}</div>
    <p class="sa-note">Every job you applied for, where it stands, and what is next.</p>`;
}

interface Tile {
  go: string;
  icon: string;
  label: string;
  count: number;
  line: string;
}

/** One "Needs you now" tile: the name with a blue dot when it holds something, the number, one line. */
function tile({ go, icon, label, count, line }: Tile): string {
  const inside = `<span class="k">${I(icon, 16)}${label}${count ? '<i class="sa-tdot"></i>' : ''}</span><span class="v${count ? '' : ' zero'}">${count}</span><span class="d">${line}</span>${go ? I('arrowRight', 16, 'arr') : ''}`;
  return go ? `<button type="button" class="sa-tile" data-go="${go}">${inside}</button>` : `<div class="sa-tile">${inside}</div>`;
}

function dashPage(s: State): string {
  const fresh = s.mails.filter((m) => m.isNew);
  const today = fresh.filter((m) => /^\d|^Just now/.test(m.date)).length;
  const open = needing(s).length;
  let newLine = 'You have opened every job mail';
  if (fresh.length) newLine = today ? `<b>${today} today</b> · not opened yet` : 'Not opened yet';
  return `<div class="sa-lt dash"><h3 class="sa-big" tabindex="-1">Dashboard</h3>
    <p class="sa-status">Good morning, Alex · Monday, November 3 · your job search, from your mails since Oct 1</p></div>
    <div class="sa-dash">
      <section class="sa-dsec"><div class="sa-dsh"><h4>Needs you now</h4></div><div class="sa-tiles">
        ${tile({ go: 'mails', icon: 'mail', label: 'New job mails', count: fresh.length, line: newLine })}
        ${tile({ go: 'mails', icon: 'todo', label: 'Needs action', count: open, line: open ? 'Answer them, or mark them done' : 'Nothing is waiting on you' })}
        ${tile({ go: '', icon: 'calendar', label: 'Interviews coming up', count: 0, line: 'No interviews booked yet' })}
      </div></section>
      <section class="sa-dsec"><div class="sa-dsh"><h4>Your progress</h4><span class="sa-period">Last 30 days ${I('chevronDown', 16)}</span></div>${PROGRESS}</section>
    </div>`;
}

/** The step's second line in its row: when it is due, else where it stands. */
function stepRowState(m: Mail): string {
  if (m.state === 'OPEN' && m.due && !m.fake) return `<span class="due">${m.due.replace(/^By /, 'Due ')}</span>`;
  if (m.fake) return fakeTag;
  return state(m);
}

/** The next step as one row; a tap opens its sheet. With nothing asked, the row only says so. */
function stepCard(m: Mail): string {
  if (asksNothing(m))
    return '<div class="sa-stepc"><span class="c"><span class="o">Next step</span><span class="m none">Nothing needed from you</span></span></div>';
  return `<button type="button" class="sa-stepc tap${m.state === 'DONE' ? ' done' : ''}" data-act="step" aria-label="Next step: ${esc(m.step)}">
    <span class="c"><span class="o">Next step</span><span class="m">${esc(m.step)}</span><span class="row">${stepRowState(m)}</span></span>${I('chevronRight', 18, 'chev')}</button>`;
}

/** How the step closes, or why it closed, under the actions in its sheet. */
function stepNote(m: Mail): string {
  if (m.fake) return 'NorthList marked this mail. It stays in your list, and you decide.';
  if (m.state === 'OPEN') return m.how === 'link' ? 'When you have done it, choose "I did this".' : 'Closes by itself when your reply answers it.';
  if (m.state === 'REPLIED') return m.note ?? `You replied ${m.repliedAt}. The AI reads your reply and closes the step if it answers it.`;
  return m.closed ? `${m.closed}. Reopen puts it back on your list.` : '';
}

/** Everything about the step: what it asks, when, where it stands, and I did this or Reopen. */
function stepSheet(s: State, m: Mail, enter: Enter): string {
  if (s.sheet !== 'step') return '';
  const due = m.due && m.state === 'OPEN' && !m.fake ? `<p class="sa-sdue">${I('calendar', 18)} ${esc(m.due.replace(/^By /, 'Due '))}</p>` : '';
  const acts = [
    m.state === 'OPEN' && m.how === 'link' && !m.fake ? `<button type="button" class="sa-act" data-act="did">${I('checkCircle', 22)}I did this</button>` : '',
    m.state !== 'OPEN' ? `<button type="button" class="sa-act" data-act="reopen">${I('reopen', 22)}Reopen</button>` : '',
    m.thread.some((x) => !x.you) ? `<button type="button" class="sa-act" data-act="showmail">${I('mail', 22)}Show the mail that asks</button>` : '',
  ].join('');
  const reading = m.checking ? '<p class="sa-note"><span class="shimmer">AI is reading your reply</span></p>' : '';
  return `<div class="sa-scrim" data-act="closesheet"></div><div class="sa-sheet${enter === 'sheet' ? ' in' : ''}" role="dialog" aria-label="Next step">
    <span class="grab"></span>
    <div class="sh"><h4>Next step</h4><button type="button" class="sa-sx" data-act="closesheet" aria-label="Close">${I('close', 20)}</button></div>
    <div class="sb"><p class="sa-stitle">${esc(m.step)}</p>${due}<span class="sa-sstate">${m.fake ? fakeTag : state(m)}</span>${reading}<div class="sa-group">${acts}</div><p class="sa-note">${stepNote(m)}</p></div></div>`;
}

/** "Today", "Yesterday" or "Oct 14": the day line above the first mail of each day. */
const dayOf = (when: string) => when.replace(/,.*$/, '');

function message(msg: Mail['thread'][number], asks: boolean): string {
  const to = msg.you ? `to ${esc(msg.email.split('@')[0])}` : 'to me';
  const second = msg.fold ? `<span class="snip">${esc(msg.body.replace(/\s+/g, ' '))}</span>` : `<span class="when">${esc(msg.when)}</span>`;
  const head = `${avatar(msg.from, msg.you)}<span class="who"><span class="wt"><b>${esc(msg.from)}</b><span class="to">${to}</span></span>${second}</span>${asks ? '<span class="tag tag-yellow">Asks you</span>' : ''}`;
  return `<article class="sa-pmsg${msg.fold ? ' fold' : ''}${msg.you ? ' you' : ''}"><header>${head}</header>${msg.fold ? '' : `<div class="b">${esc(msg.body)}</div>`}</article>`;
}

/** The mails of a conversation, with a day line wherever the day changes. */
function thread(m: Mail): string {
  const asks = asking(m);
  let day = '';
  return m.thread
    .map((x) => {
      const line = dayOf(x.when) === day ? '' : `<div class="sa-day">${esc(dayOf(x.when))}</div>`;
      day = dayOf(x.when);
      return line + message(x, x === asks);
    })
    .join('');
}

/** A mail on a phone: the big subject, its facts, the way to Gmail, the next step, the mails edge to edge. */
function mailPage(m: Mail): string {
  const job = m.app ? `<span>${I('briefcase', 16)}${esc(m.app.job)}</span>` : '';
  const facts = `<span class="facts"><span>${I('building', 16)}${esc(m.company)}</span>${job}${m.app ? statusTag(m.app.status) : ''}<span>${mailCount(m)}</span></span>`;
  return `<div class="sa-dhead"><h3 class="sa-big d" tabindex="-1">${esc(m.subject)}</h3>${facts}
    <button type="button" class="sa-gmail" data-soon="Gmail is not part of this example">Open in Gmail${I('ext', 14)}</button></div>
    ${stepCard(m)}
    <div class="sa-pthread">${thread(m)}</div>`;
}

/** The floating action bar on a mail: Reply, Done or Reopen, AI reply, More. */
function actionBar(m: Mail): string {
  const btn = (attrs: string, ic: string, label: string) => `<button type="button" ${attrs}>${I(ic, 24)}<span>${label}</span></button>`;
  let step = '';
  if (m.state === 'OPEN' && m.how === 'link' && !m.fake) step = btn('data-act="did"', 'checkCircle', 'Done');
  else if (m.state !== 'OPEN' && !asksNothing(m)) step = btn('data-act="reopen"', 'reopen', 'Reopen');
  return `<nav class="sa-bar sa-actions glass" aria-label="Mail actions">${btn('data-act="reply"', 'reply', 'Reply')}${step}${btn('data-act="aireply"', 'ai', 'AI reply')}${btn('data-soon="More is in the real app, not in this example"', 'more', 'More')}</nav>`;
}

const TABS: [string, string, string][] = [
  ['dashboard', 'dashboard', 'Dashboard'],
  ['mails', 'mail', 'Mails'],
  ['applications', 'doc', 'Applications'],
  ['settings', 'settings', 'Settings'],
];

/** The floating glass tab bar: line icons when off, filled and blue when on, a soft highlight behind the chosen tab. */
function tabBar(s: State): string {
  const on = Math.max(0, TABS.findIndex(([v]) => v === s.view));
  const tabs = TABS.map(([v, ic, label], i) => {
    const go = v === 'settings' ? 'data-soon="Settings are in the real app, not in this example"' : `data-go="${v}"`;
    return `<button type="button" ${go} class="${i === on ? 'on' : ''}"${i === on ? ' aria-current="page"' : ''}>${i === on ? tabIcon(ic, 26) : I(ic, 26)}<span>${label}</span></button>`;
  }).join('');
  return `<nav class="sa-bar sa-tabbar glass" aria-label="Sample app pages"><span class="pill" style="transform:translateX(${on * 100}%)"></span>${tabs}</nav>`;
}

/** The reply sheet: × and Send at the top, To, the AI's help, the reply, the text tools at the bottom. */
function replySheet(s: State, m: Mail, enter: Enter): string {
  const r = s.reply;
  if (!r) return '';
  return `<div class="sa-scrim"></div><div class="sa-sheet large${enter === 'sheet' ? ' in' : ''}" role="dialog" aria-label="Reply">
    <span class="grab"></span>
    <div class="sh"><button type="button" class="sa-sx" data-act="cancel" aria-label="Close">${I('close', 20)}</button><h4>Reply</h4>${sendButton(r, true)}</div>
    <div class="sb"><div class="to">To <span>${esc(m.from)}</span></div>${aiHelp(m, true)}${replyBody(r)}</div>
    <div class="tools">${TEXT_TOOLS}</div></div>`;
}

/** ⓘ on a mail: key dates and the application, in a short sheet. */
function infoSheet(s: State, m: Mail, enter: Enter): string {
  if (s.sheet !== 'info') return '';
  const app = m.app
    ? `<button type="button" class="sa-grow" data-go="applications"><span class="c"><span class="m">${esc(m.company)}</span><span class="d">${esc(m.app.job)}</span></span>${statusTag(m.app.status)}${I('chevronRight', 18, 'chev')}</button>`
    : '<div class="sa-grow"><span class="c"><span class="d">Not linked to an application</span></span></div>';
  const dates = m.due ? `<dl class="sa-dl"><dt>Reply by</dt><dd>${esc(m.due.replace(/^By /, ''))}</dd></dl>` : '<p class="sa-note">This mail names no dates.</p>';
  return `<div class="sa-scrim" data-act="closesheet"></div><div class="sa-sheet${enter === 'sheet' ? ' in' : ''}" role="dialog" aria-label="About this job mail">
    <span class="grab"></span>
    <div class="sh"><h4>About this job mail</h4><button type="button" class="sa-sx" data-act="closesheet" aria-label="Close">${I('close', 20)}</button></div>
    <div class="sb"><h5>Key dates</h5>${dates}<h5>Application</h5><div class="sa-group">${app}</div></div></div>`;
}

/** The filters menu: grows out of the capsule's filter button. */
function filtersMenu(s: State): string {
  if (s.menu !== 'filters') return '';
  const item = (act: string, on: boolean, label: string) =>
    `<button type="button" data-act="${act}" role="menuitemcheckbox" aria-checked="${on}"><span class="ck">${on ? I('check', 18) : ''}</span>${label}</button>`;
  return `<div class="sa-menu glass-menu" role="menu" aria-label="Filters">${item('needs', s.needsOnly, 'Needs action')}${item('new', s.newOnly, 'New only')}</div>`;
}

/** The whole phone layout for the current state. */
export function phone(s: State, m: Mail | null, enter: Enter = ''): string {
  const page = m
    ? mailPage(m)
    : { mails: () => mailsPage(s), applications: () => appsPage(s), dashboard: () => dashPage(s), mail: () => mailsPage(s) }[s.view]();
  const small = m ? esc(m.company) : { mails: 'Job mails', applications: 'Applications', dashboard: 'Dashboard', mail: 'Job mails' }[s.view];
  const left = m ? glassBtn('data-act="back"', 'chevronLeft', 'Back') : '';
  let right = '';
  if (m) right = glassBtn('data-act="info"', 'info', 'About this job mail');
  else if (s.view === 'dashboard') right = `<div class="sa-cap glass one"><button type="button" data-act="sync" aria-label="Refresh" ${s.syncing ? 'disabled' : ''}>${I('renew', 22, s.syncing ? 'spin' : '')}</button></div>`;
  else right = capsule(s, s.view !== 'applications');
  const sheet = m ? replySheet(s, m, enter) || infoSheet(s, m, enter) || stepSheet(s, m, enter) : '';
  const enterCls = { push: ' in-push', pop: ' in-pop', sheet: '', '': '' }[enter];
  return `<div class="sa-p${sheet ? ' sheeted' : ''}${s.reply ? ' tall' : ''}">
    <div class="sa-stage">
      <div class="sa-pmain${enterCls}">${page}</div>
      <div class="sa-edge"></div>
      <div class="sa-pnav"><div class="l">${left}</div><span class="ttl">${small}</span><div class="r">${right}</div></div>
      ${m ? actionBar(m) : tabBar(s)}
      ${filtersMenu(s)}
    </div>
    ${sheet}
  </div>`;
}
