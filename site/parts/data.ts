import { icon, mark } from './icons.ts';

/*
 * The data lead and the four promises: one wording, shown word for word on Home, Privacy and About.
 * Every sentence matches the privacy policy (`site/public/privacy.html`); never "stores nothing".
 */
export const DATA_LEAD =
  "To find your job mails, NorthList's AI looks at the sender, subject, Gmail labels and short preview of each new mail. It reads the text of job mails only.";

export const PROMISES: [string, string, string][] = [
  [
    'mail',
    'Read and send, never change',
    "When you connect Gmail, you give two permissions: read mail, to find your job mails and show you your mail, and send mail, for your replies only. NorthList can't change or delete anything in your Gmail.",
  ],
  [
    'mailOff',
    'Never the text of your mails',
    "For each job mail, NorthList keeps the subject, sender, date, Gmail's ids and what the AI found, sometimes with a short quote for interview times. Not the text or the attachments. Ask, and everything is deleted within 7 days.",
  ],
  ['shield', 'The AI keeps nothing', "NorthList asks the AI service to keep nothing, so it can't store your mail or train on it."],
  ['eyeOff', 'No ads, no tracking', "NorthList doesn't show ads, sell your data, or use analytics or tracking tools."],
];

export function promises(): string {
  return PROMISES.map(([ic, title, text]) => `<div class="promise">${icon(ic, 20)}<b>${title}</b><p>${text}</p></div>`).join('');
}

/** How a new mail moves (Privacy page): a vertical chain of boxes, joined by what passes between them. */
const STEPS = [
  { ic: icon('mail', 18), title: 'Your Gmail', text: "Stays as it is. NorthList reads it and sends only the replies you write. It can't change or delete anything." },
  'New mail, about once an hour',
  { ic: mark(18), title: 'NorthList', text: 'Skips Promotions, Social and Spam, except LinkedIn mail under Social. Sends only what the AI needs.' },
  'Sender, subject, labels, preview; text of job mails',
  {
    ic: icon('model', 18),
    title: 'AI service',
    text: "Reads it and answers. NorthList asks it to keep nothing, so it can't store your mail or train on it.",
    accent: true,
  },
  'Company, role, next step',
  { ic: icon('list', 18), title: 'Your list', text: 'Subject, sender, date and what the AI found. Never the text of the mail.' },
];

export function flow(): string {
  const parts = STEPS.map((s) => {
    if (typeof s === 'string') return `<div class="wire"><span>${s}</span></div>`;
    const badge = s.accent ? '<span class="tag tag-tint badge">Zero data retention</span>' : '';
    return `<div class="node${s.accent ? ' accent' : ''}"><div class="nh"><span class="ni">${s.ic}</span>${s.title}</div><p>${s.text}</p>${badge}</div>`;
  });
  return `<div class="flow" role="img" aria-label="Your Gmail sends new mail to NorthList about once an hour. NorthList sends the sender, subject, Gmail labels and preview, and the text of job mails, to an AI service that is asked to keep nothing. The AI returns the company, role and next step, which become your list.">
    ${parts.join('\n    ')}
  </div>
  <p class="live-line">${icon('eye', 16)}<span><b>When you open a mail,</b> NorthList reads it live from Gmail and shows it to you. Its servers don't save it.</span></p>`;
}
