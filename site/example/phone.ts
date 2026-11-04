import { icon as I } from '../parts/icons.ts';
import { shownMails, TYPE, type Mail, type State } from './data.ts';
import { dashView } from './laptop.ts';
import { avatar, esc, fakeTag, mailCount, message, nextCard, replyBox, statusTag, stepLine, synced } from './pieces.ts';

/* The example's phone layout, as in the real app on a phone: top bar, one list, tabs at the bottom. */

/** One mail, as in the app on a phone: who and when, the subject, the next step, the application. */
function mailCard(m: Mail): string {
  const app = m.app
    ? `${statusTag(m.app.status)}<span>${esc(m.company)} · ${esc(m.app.job)}</span>`
    : `<span>${TYPE[m.type][0]} · Not linked</span>`;
  return `<div class="sa-pcard${m.fresh ? ' sa-new' : ''}" data-open="${m.id}" tabindex="0" role="button">
    ${avatar(m.from)}
    <div><div class="l1"><b class="${m.isNew ? 'new' : ''}">${esc(m.from)}</b>${m.isNew ? '<i class="sa-dot" aria-label="New"></i>' : ''}<span class="dt">${m.date}</span></div>
    <div class="subj">${esc(m.subject)}</div>${stepLine(m, 'stpl stp', true)}
    <div class="tg${m.reading ? ' sa-wait' : ''}">${app}</div></div></div>`;
}

/** Needs action and New only, one tap each; Filters (a dead end here); the sync button at the end. */
function chips(s: State): string {
  const chip = (act: string, on: boolean, label: string) =>
    `<button type="button" class="sa-qchip" data-act="${act}" aria-pressed="${on}">${label}</button>`;
  return `<div class="sa-ptools">${chip('needs', s.needsOnly, 'Needs action')}${chip('new', s.newOnly, 'New only')}<span class="sa-qchip">${I('filter', 14)} Filters</span>
    <button type="button" class="sa-icon-btn" data-act="sync" aria-label="Sync now" ${s.syncing ? 'disabled' : ''}>${I('renew', 18, s.syncing ? 'spin' : '')}</button></div>`;
}

/** The list, then "Synced Today, 9:40 AM" at its end, as in the app. */
function mails(s: State): string {
  return `${chips(s)}${shownMails(s).map(mailCard).join('')}<div class="sa-pbar">${synced(s)}</div>`;
}

function mail(s: State, m: Mail): string {
  if (s.reply) return `<div class="sa-preply">${replyBox(m, s.reply)}</div>`;
  return `<div class="sa-ppage"><h3 class="sa-h1" tabindex="-1">${esc(m.subject)}</h3><div class="sa-tagrow">${m.app ? statusTag(m.app.status) : ''}${m.fake ? fakeTag : ''}<span class="sa-meta">${mailCount(m)}</span></div>
    <div class="sa-conv"><div class="sa-cards">${nextCard(m)}</div><div class="sa-thread">${m.thread.map(message).join('')}</div></div></div>`;
}

function apps(s: State): string {
  const cards = s.apps
    .map((a) => {
      const open = a.mail ? `data-open="${a.mail}" tabindex="0" role="button"` : '';
      const todo = a.todo ? `<span>${esc(a.todo)}</span>` : '';
      return `<div class="sa-pcard app" ${open}>${avatar(a.co)}<div><div class="l1"><b>${esc(a.co)}</b><span class="dt">${a.applied}</span></div><div class="subj">${esc(a.job)}</div><div class="tg">${statusTag(a.status)}${todo}</div></div></div>`;
    })
    .join('');
  return `<div class="sa-pbar">${s.apps.length} applications</div>${cards}`;
}

const TABS: [string, string, string][] = [
  ['dashboard', 'dashboard', 'Dashboard'],
  ['mails', 'mail', 'Mails'],
  ['applications', 'doc', 'Applications'],
];
const TITLE = { dashboard: 'Dashboard', mails: 'Mails', applications: 'Applications', mail: 'Mails' };

/** The top bar: the menu (a dead end in the example) or Back, the page title, search and the avatar. */
function topBar(s: State, m: Mail | null): string {
  const left = m
    ? `<button type="button" data-act="${s.reply ? 'cancel' : 'back'}" aria-label="Back">${I(s.reply ? 'close' : 'arrowLeft', 18)}</button>`
    : `<button type="button" data-soon aria-label="Menu">${I('menu', 18)}</button>`;
  let title = TITLE[s.view];
  // On Mails the title switches between the lists, as in the app: "Job mails ▾"
  if (s.view === 'mails') title = `Job mails ${I('chevronDown', 14)}`;
  if (m) title = s.reply ? 'Reply' : esc(m.company);
  return `<div class="sa-ptop">${left}<span class="pt">${title}</span><span>${I('search', 18)}</span><span><span class="sa-avatar">A</span></span></div>`;
}

/** The whole phone layout for the current state. */
export function phone(s: State, m: Mail | null): string {
  const title = TITLE[s.view];
  const view = m
    ? mail(s, m)
    : {
        mails: () => mails(s),
        applications: () => apps(s),
        dashboard: () => `<div class="sa-ppage">${dashView(s).replace('<div class="sa-page">', '<div>')}</div>`,
        mail: () => mails(s),
      }[s.view]();
  const tabs = TABS.map(
    ([v, ic, label]) => `<button type="button" data-go="${v}" class="${title === label ? 'on' : ''}"><i>${I(ic, 18)}</i>${label}</button>`,
  ).join('');
  return `<div class="sa-p">
    ${topBar(s, m)}
    <div class="sa-pmain">${view}</div>
    ${m ? '' : `<nav class="sa-ptabs" aria-label="Sample app pages">${tabs}</nav>`}
    ${m && !s.reply ? `<button type="button" class="sa-fab" data-act="reply">${I('reply', 16)} Reply</button>` : ''}
  </div>`;
}
