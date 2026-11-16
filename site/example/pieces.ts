import { appIcon as I } from '../parts/appIcons.ts';
import { STATUS, type Mail, type Message, type Reply, type State, type Status } from './data.ts';

/*
 * Small parts of the example, drawn as in the real app (new look, owner, 13 Nov 2026: Lucide icons, the
 * device's own font, round buttons and chips): initials, tags, the next step, the reply box, cards.
 */

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

/** The step's state on the mail page: Needs action, Replied or Done. */
export function state(m: Mail): string {
  if (m.state === 'OPEN' && m.fake) return '';
  if (m.state === 'OPEN') return '<span class="tag tag-yellow">Needs action</span>';
  if (m.state === 'REPLIED') return `<span class="state">${I('reply', 12)} Replied</span>`;
  return `<span class="state">${I('checkCircle', 12)} Done</span>`;
}

/** A mail that asks for nothing: a rejection, not a step that closed. */
export const asksNothing = (m: Mail) => m.state === 'DONE' && !m.closed && m.step === 'Nothing to do';

const STEP_ICON = { OPEN: 'arrowRight', REPLIED: 'reply', DONE: 'checkCircle' } as const;

/**
 * The next step, as in the app's Mails list: a blue arrow while it is open, a reply mark once replied,
 * a grey tick and a line through it when done, or "Nothing needed".
 */
export function stepLine(m: Mail, cls: string, size = 16): string {
  if (m.reading) return `<span class="${cls}"><span class="shimmer">AI is reading this mail</span></span>`;
  if (asksNothing(m)) return `<span class="${cls} none">${I('check', size)}<span>Nothing needed</span></span>`;
  const due = m.due && m.state === 'OPEN' && cls === 'sa-step' ? ` <span class="due">· ${m.due.replace(/^By /, 'Due ')}</span>` : '';
  const fake = m.fake && cls === 'sa-step' ? ` ${fakeTag}` : '';
  return `<span class="${cls} ${m.state.toLowerCase()}">${I(STEP_ICON[m.state], size)}<span><span class="w">${esc(m.step)}</span>${due}${fake}</span></span>`;
}

/** "5 mails · 2 from you" */
export function mailCount(m: Mail): string {
  const mine = m.thread.filter((x) => x.you).length;
  const all = m.thread.length;
  return `${all} mail${all === 1 ? '' : 's'}${mine ? ` · ${mine} from you` : ''}`;
}

/** The side menu's reading status, in the app's words. */
export function reading(s: State): string {
  return s.reading
    ? `<div class="sa-reading"><span class="l1">${I('info', 14)} <span class="shimmer">Reading your new mails</span></span><span class="l2">0 of 1 · NorthList free AI</span></div>`
    : `<div class="sa-reading"><span class="l1">${I('checkCircle', 14)} Done reading your new mails</span><span class="l2">NorthList free AI</span></div>`;
}

/** "Send reply" on the laptop, "Send" in the phone's sheet; "Sending…" while it sends. */
export function sendButton(r: Reply, short = false): string {
  const off = !r.text.trim() || r.writing || r.sending ? 'disabled' : '';
  let label = short ? 'Send' : 'Send reply';
  if (r.sending) label = 'Sending…';
  return `<button type="button" class="sa-btn pri" data-act="send" ${off}>${label}</button>`;
}

/** "Reply with AI": the AI's choices for this mail, an optional hint and "Write with AI". */
export function aiHelp(m: Mail, phone = false): string {
  const choices = (m.choices ?? ['Say thank you', 'Ask a question'])
    .map((c, i) => `<button type="button" class="chip" data-ai="${i}">${esc(c)}</button>`)
    .join('');
  const hint = phone ? 'Optional: what to say' : 'Optional: what to say, like &quot;I\'m free Tue after 3&quot;';
  return `<div class="aihelp" role="group" aria-label="Reply with AI"><span class="lbl">${phone ? I('ai', 16) : ''}Reply with AI</span><div class="chips">${choices}</div>
    <div class="hintrow"><input class="sa-hint" placeholder="${hint}" aria-label="What to say"><button type="button" class="sa-btn${phone ? ' pri' : ''}" data-ai="write">Write with AI</button></div></div>`;
}

export function replyBody(r: Reply): string {
  return r.writing
    ? '<div class="sa-writing"><span class="shimmer">AI is writing your reply…</span></div>'
    : `<textarea class="sa-ta" placeholder="Write your reply" aria-label="Reply">${esc(r.text)}</textarea>`;
}

/** The text tools under the reply, as in the app: bold, italic, underline, lists, link. */
export const TEXT_TOOLS = `<span>${I('bold', 16)}</span><span>${I('italic', 16)}</span><span>${I('underline', 16)}</span><i class="sep"></i><span>${I('list', 16)}</span><span>${I('listOrdered', 16)}</span><i class="sep"></i><span>${I('link', 16)}</span>`;

/** The laptop's reply box, under the conversation: × closes it (Esc too in the app). */
export function replyBox(m: Mail, r: Reply): string {
  return `<div class="sa-reply">
    <div class="sa-rhead"><span class="to">To: ${esc(m.from)} &lt;${esc(m.email)}&gt;</span><button type="button" class="sa-x" data-act="cancel" aria-label="Close reply">${I('close', 16)}</button></div>
    ${aiHelp(m)}
    <div class="editor"><div class="tb">${TEXT_TOOLS}</div>${replyBody(r)}
      <div class="efoot">${sendButton(r)}</div></div>
  </div>`;
}

/** The laptop's closed reply: one line under the conversation that opens the box. */
export const replyBar = (m: Mail) =>
  `<button type="button" class="sa-replybar" data-act="reply">${I('reply', 16)}<span>Reply to ${esc(m.from)}…</span></button>`;

function nextFoot(m: Mail): string {
  let foot: string;
  if (m.fake) foot = '<p class="sa-meta">NorthList marked this mail. It stays in your list, and you decide.</p>';
  else if (m.state === 'OPEN')
    foot = `<p class="sa-meta">${m.how === 'link' ? 'Mark it done when you have finished it.' : 'Closes by itself when your reply answers it.'}</p>`;
  else if (m.state === 'REPLIED') {
    let after = m.note ? `<p class="sa-meta">${m.note}</p>` : '';
    if (m.checking) after = '<span class="shimmer xs">AI is reading your reply</span>';
    foot = `<p class="sa-meta">You replied ${m.repliedAt}.</p>${after}`;
  } else foot = `<span class="sa-closed">${I('checkCircle', 14)} ${m.closed ?? 'Nothing to do'}</span>`;
  if (m.how === 'link' && m.state !== 'DONE')
    foot += `<button type="button" class="sa-btn" data-act="did">${I('check', 14)} I did this</button>`;
  if (m.state !== 'OPEN' && !asksNothing(m))
    foot += `<button type="button" class="sa-btn" data-act="reopen">${I('reopen', 14)} Reopen</button>`;
  return foot;
}

export function nextCard(m: Mail): string {
  const title = m.fake ? `${I('warning', 16)} Probably a fake offer` : 'Next step';
  const due = m.due && m.state === 'OPEN' ? `<p class="sa-due">${I('calendar', 14)} ${m.due.replace(/^By /, 'Due ')}</p>` : '';
  return `<section class="sa-card${m.fake ? ' warn' : ''}"><h4>${title}</h4>
    <p class="step">${esc(m.step)}</p>${due}${m.fake ? '' : state(m)}${nextFoot(m)}
    <hr><span class="from">${I('arrowDown', 14)} From ${esc(m.from)}'s mail, ${esc(m.when)}</span></section>`;
}

export function appCard(m: Mail): string {
  if (!m.app) return '<section class="sa-card"><h4>Application</h4><p class="sa-meta">Not linked</p></section>';
  return `<section class="sa-card"><h4>Application</h4><button type="button" class="sa-co" data-go="applications">${esc(m.company)}</button><p class="sa-meta">${esc(m.app.job)}</p>${statusTag(m.app.status)}</section>`;
}

/** The mail that asks: the newest one from them while the step is open. */
export const asking = (m: Mail) => (m.state === 'OPEN' && !m.fake ? [...m.thread].reverse().find((x) => !x.you) : undefined);

export function message(msg: Message, asks = false): string {
  return `<article class="sa-msg${msg.you ? ' you' : ''}${msg.fold ? ' fold' : ''}"><header>${avatar(msg.from, msg.you)}<div><b>${esc(msg.from)}</b> <span class="sa-meta">${msg.you ? `to ${esc(msg.email.split('@')[0])}` : 'to me'}</span><span class="sa-meta when">${esc(msg.when)}</span></div>${asks ? '<span class="tag tag-yellow">Asks you</span>' : ''}</header><div class="sa-msg-b">${esc(msg.body)}</div></article>`;
}

/** "Synced Today, 9:40 AM", "Synced just now", or the grey "Checking Gmail" while it checks. */
export function synced(s: State): string {
  if (s.syncing) return '<span class="shimmer">Checking Gmail</span>';
  return `Synced ${s.syncedAt === 'just now' ? 'just now' : `Today, ${s.syncedAt}`}`;
}

/** "3 mails need you. Everything else is up to date." The count turns the Needs action filter on and off. */
export function summary(needs: number, on: boolean): string {
  if (needs === 0) return 'Nothing needs you right now. Everything is up to date.';
  return `<button type="button" class="sa-need" data-act="needs" aria-pressed="${on}">${needs === 1 ? '1 mail needs you' : `${needs} mails need you`}</button>. Everything else is up to date.`;
}
