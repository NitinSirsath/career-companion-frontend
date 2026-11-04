import { icon as I } from '../parts/icons.ts';
import { STATUS, TYPE, type Mail, type Message, type Reply, type State, type Status } from './data.ts';

/* Small parts of the example, drawn as in the real app: initials, tags, the next step, the reply box, cards. */

export const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export const statusTag = (s: Status) => `<span class="tag tag-${STATUS[s][1]}">${STATUS[s][0]}</span>`;
export const fakeTag = `<span class="tag tag-yellow">${I('warning', 12)} Probably fake</span>`;

/** One of six soft colours for a name, the same way the app picks them (src/lib/avatarTone.ts). */
export function tone(name: string): string {
  let sum = 0;
  for (const char of name.trim().toLowerCase().replace(/\s+/g, ' ')) sum += char.charCodeAt(0);
  return `t${(sum % 6) + 1}`;
}

/** Coloured initials: "Priya Nair" is PN; the visitor is A. */
export function avatar(name: string, you = false): string {
  const init = you
    ? 'A'
    : name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
  return `<span class="sa-av ${you ? 'you' : tone(name)}" aria-hidden="true">${esc(init)}</span>`;
}

export function type(m: Mail): string {
  const [label, ic] = TYPE[m.type];
  return `<span class="sa-type">${I(ic, 14)} ${label}</span>`;
}

/** The step's state on the mail page: Needs action, Replied or Done. */
export function state(m: Mail): string {
  if (m.state === 'OPEN' && m.fake) return '';
  if (m.state === 'OPEN') return '<span class="tag tag-yellow">Needs action</span>';
  if (m.state === 'REPLIED') return `<span class="state">${I('reply', 12)} Replied</span>`;
  return `<span class="state">${I('check', 12)} Done</span>`;
}

/** A mail that asks for nothing: a rejection, not a step that closed. */
const asksNothing = (m: Mail) => m.state === 'DONE' && !m.closed && m.step === 'Nothing to do';

const STEP_ICON = { OPEN: 'arrowRight', REPLIED: 'reply', DONE: 'check' } as const;

/**
 * The next step, as in the app's Mails list: a blue arrow while it is open, a reply mark once replied,
 * a green check when done, or "Nothing needed". `dueApart`: the due date on its own line (phones).
 */
export function stepLine(m: Mail, cls: string, dueApart = false): string {
  if (m.reading) return `<span class="${cls}"><span class="shimmer">AI is reading this mail</span></span>`;
  if (asksNothing(m)) return `<span class="${cls} sa-none">Nothing needed</span>`;
  const due = m.due && m.state === 'OPEN' ? m.due : '';
  const inline = due && !dueApart ? ` <span class="due">· ${due}</span>` : '';
  const line = `<span class="${cls} ${m.state.toLowerCase()}">${I(STEP_ICON[m.state], 16)}<span>${esc(m.step)}${inline}${m.fake ? ` ${fakeTag}` : ''}</span></span>`;
  return due && dueApart ? `${line}<span class="pdue">${due}</span>` : line;
}

/** "5 mails · 2 from you" */
export function mailCount(m: Mail): string {
  const mine = m.thread.filter((x) => x.you).length;
  const all = m.thread.length;
  return `${all} mail${all === 1 ? '' : 's'}${mine ? ` · ${mine} from you` : ''}`;
}

/** The side menu's reading status. */
export function reading(s: State): string {
  return s.reading
    ? '<div class="sa-reading"><span class="l1"><span class="shimmer">AI is reading your mails</span></span><span class="l2">1 mail left · under a minute</span></div>'
    : `<div class="sa-reading"><span class="l1">${I('check', 12)} All mails read</span><span class="l2">NorthList free AI</span></div>`;
}

function sendButton(r: Reply): string {
  const off = !r.text.trim() || r.writing || r.sending ? 'disabled' : '';
  const label = r.sending ? `${I('renew', 14, 'spin')} Sending` : `${I('send', 14)} Send`;
  return `<button type="button" class="sa-btn pri" data-act="send" ${off}>${label}</button>`;
}

export function replyBox(m: Mail, r: Reply): string {
  const choices = (m.choices ?? ['Say thank you', 'Ask a question'])
    .map((c, i) => `<button type="button" class="chip" data-ai="${i}">${esc(c)}</button>`)
    .join('');
  const body = r.writing
    ? '<div class="sa-writing"><span class="shimmer">Writing your reply from the whole conversation</span></div>'
    : `<textarea class="sa-ta" placeholder="Write your reply" aria-label="Reply">${esc(r.text)}</textarea>`;
  return `<div class="sa-reply">
    <span class="to">To: ${esc(m.from)} &lt;${esc(m.email)}&gt;</span>
    <div class="aihelp"><span class="lbl">Reply with AI</span><div class="chips">${choices}</div>
      <div class="hintrow"><input class="sa-hint" placeholder="Optional: what to say, like &quot;I'm free Tue after 3&quot;" aria-label="What to say"><button type="button" class="sa-btn" data-ai="write">${I('pen', 14)} Write with AI</button></div></div>
    <div class="editor"><div class="tb"><span>B</span><span><i>I</i></span><span><u>U</u></span><i class="sep"></i><span>${I('list', 14)}</span><span>${I('ext', 13)}</span></div>${body}
      <div class="efoot"><span style="display:flex;gap:8px"><button type="button" class="sa-btn" data-act="cancel">Discard</button>${sendButton(r)}</span></div></div>
  </div>`;
}

function nextFoot(m: Mail): string {
  let foot: string;
  if (m.fake) foot = '<p class="sa-meta">NorthList marked this mail. It stays in your list, and you decide.</p>';
  else if (m.state === 'OPEN')
    foot = `<p class="sa-meta">${m.how === 'link' ? 'Mark it done when you have finished it.' : 'Closes by itself when your reply answers it.'}</p>`;
  else if (m.state === 'REPLIED') {
    let after = m.note ? `<p class="sa-meta">${m.note}</p>` : '';
    if (m.checking) after = '<span class="shimmer xs">AI is reading your reply</span>';
    foot = `<p class="sa-meta">You replied ${m.repliedAt}.</p>${after}`;
  } else foot = `<span class="sa-closed">${I('check', 12)} ${m.closed ?? 'Nothing to do'}</span>`;
  if (m.how === 'link' && m.state !== 'DONE')
    foot += `<button type="button" class="sa-btn" data-act="did">${I('check', 14)} I did this</button>`;
  return foot;
}

export function nextCard(m: Mail): string {
  const title = m.fake ? `${I('warning', 14)} Probably a fake offer` : 'Next step';
  const due = m.due && m.state === 'OPEN' ? `<p class="sa-meta">${m.due}</p>` : '';
  return `<section class="sa-card${m.fake ? ' warn' : ''}"><h4>${title}</h4>
    <p class="step">${esc(m.step)}</p>${due}${m.fake ? '' : state(m)}${nextFoot(m)}
    <hr><span class="from">${I('arrowDown', 12)} From ${esc(m.from)}'s mail, ${esc(m.when)}</span></section>`;
}

export function appCard(m: Mail): string {
  if (!m.app) return '<section class="sa-card"><h4>Application</h4><p class="sa-meta">Not linked</p></section>';
  return `<section class="sa-card"><h4>Application</h4><button type="button" class="sa-co" data-go="applications" style="background:none;border:0;padding:0;cursor:pointer">${esc(m.company)}</button><p class="sa-meta">${esc(m.app.job)}</p>${statusTag(m.app.status)}</section>`;
}

export function message(msg: Message): string {
  return `<article class="sa-msg${msg.you ? ' you' : ''}${msg.fold ? ' fold' : ''}"><header>${avatar(msg.from, msg.you)}<div><b>${esc(msg.from)}</b><span class="sa-meta">${esc(msg.email)}</span></div><span class="sa-meta">${esc(msg.when)}</span></header><div class="sa-msg-b">${esc(msg.body)}</div></article>`;
}

/** "Synced Today, 9:40 AM", "Synced just now", or the grey "Checking Gmail" while it checks. */
export function synced(s: State): string {
  if (s.syncing) return '<span class="shimmer">Checking Gmail</span>';
  return `Synced ${s.syncedAt === 'just now' ? 'just now' : `Today, ${s.syncedAt}`}`;
}
