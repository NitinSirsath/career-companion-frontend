import { icon as I } from '../parts/icons.ts';
import type { Mail, State } from './data.ts';
import { dashView } from './laptop.ts';
import { esc, fakeTag, message, nextCard, replyBox, state, statusTag, synced, type } from './pieces.ts';

/* The example's phone layout, as in the real app on a phone: top bar, cards, tabs at the bottom. */

function mailCard(m: Mail): string {
  return `<div class="sa-pcard${m.fresh ? ' sa-new' : ''}" data-open="${m.id}" tabindex="0" role="button">
    <span class="pav">${esc(m.company[0])}</span>
    <div><div class="l1"><b>${esc(m.company)}</b><span>${m.isNew ? '<i class="sa-dot"></i>' : ''}${m.date}</span></div>
    <div class="subj">${esc(m.subject)}</div><div class="stp">${m.reading ? '<span class="shimmer">AI is reading this mail</span>' : esc(m.step)}</div>
    <div class="tg${m.reading ? ' sa-wait' : ''}">${state(m)}${type(m)}${m.fake ? fakeTag : ''}</div></div></div>`;
}

function mails(s: State): string {
  return `<div class="sa-pbar"><span>${synced(s)}</span><button type="button" data-act="sync" ${s.syncing ? 'disabled' : ''}>Sync now</button></div>
    <div class="sa-ptools"><div class="sa-search">${I('search', 14)} Search mails</div><span class="sa-filter">${I('filter', 14)} Filters</span></div>
    ${s.mails.map(mailCard).join('')}`;
}

function mail(s: State, m: Mail): string {
  if (s.reply) return `<div class="sa-preply">${replyBox(m, s.reply)}</div>`;
  return `<div class="sa-ppage"><h3 class="sa-h1" tabindex="-1">${esc(m.subject)}</h3><div class="sa-tagrow">${m.app ? statusTag(m.app.status) : ''}${m.fake ? fakeTag : ''}</div>
    <div class="sa-conv"><div class="sa-cards">${nextCard(m)}</div><div class="sa-thread">${m.thread.map(message).join('')}</div></div></div>`;
}

function apps(s: State): string {
  const cards = s.apps
    .map((a) => {
      const open = a.mail ? `data-open="${a.mail}" tabindex="0" role="button"` : '';
      const todo = a.todo ? `<span class="sa-meta">${esc(a.todo)}</span>` : '';
      return `<div class="sa-pcard app" ${open}><span class="pav">${esc(a.co[0])}</span><div><div class="l1"><b>${esc(a.co)}</b><span>${a.applied}</span></div><div class="stp">${esc(a.job)}</div><div class="tg">${statusTag(a.status)}${todo}</div></div></div>`;
    })
    .join('');
  return `<div class="sa-pbar"><span>${s.apps.length} applications</span></div>${cards}`;
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
