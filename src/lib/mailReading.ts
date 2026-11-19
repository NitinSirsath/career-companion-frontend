/**
 * How the app reads mail, in one place (owner, 17 Nov 2026): the Gmail sync page, the free AI's
 * "What is sent" and the privacy page (`site/privacy/index.html`, checked by a test) say the same.
 * The numbers are the backend's limits: `CLASSIFICATION_INPUT_LIMITS`, `EXTRACTION_BODY_LIMIT`,
 * the reply reader's cut and `NOT_JOB_MAIL_KEPT_DAYS`.
 */
export const MAIL_LIMITS = {
  /** Sender, subject, labels and Gmail's preview, to sort a mail. */
  preview: 1000,
  /** The text of a job mail. */
  body: 8000,
  /** The new text of the user's own reply. */
  reply: 4000,
} as const;

/** A mail that is not about a job keeps only Gmail's id and its date, this many days. */
export const NOT_JOB_MAIL_KEPT_DAYS = 35;

/** "1,000 characters". */
export const chars = (count: number) => `${count.toLocaleString('en-US')} characters`;

/** The free AI's own words for where the mail goes. */
export const FREE_AI_READER =
  "OpenRouter, on NorthList's account. It passes each mail to GPT-6 Luna on Microsoft Azure servers in the US or Europe. NorthList asks for servers that keep nothing, so they cannot train on your mail.";

/** What goes to the AI, and when: the free AI's "What is sent". */
export const WHAT_IS_SENT = `For each new mail: the sender, subject, Gmail labels and a short preview (up to ${chars(MAIL_LIMITS.preview)}). For job mails, also the mail text (up to ${chars(MAIL_LIMITS.body)}). When a conversation still needs something from you, also the new text of your own replies in it. When you ask to reanalyze a conversation, the same again for its job mails and your replies in it. When you ask the AI to write a reply, the whole conversation, any hint you type or reply choice you click, and your first name. Nothing else from your mailbox.`;

/** The line under "How your mail is read": the one time more than the above is sent. */
export const WRITE_WITH_AI_NOTE =
  'When you ask the AI to write a reply, it also gets the whole conversation, any hint you type or reply choice you click, and your first name.';

export type ReadingFactKey = 'access' | 'which' | 'sort' | 'job' | 'kept' | 'ai';

export interface ReadingFact {
  key: ReadingFactKey;
  term: string;
  text: string;
}

/**
 * "How your mail is read" on the Gmail sync page. `canSend` is false for an older connection made
 * for reading only; `reader` says which AI reads the mail now.
 */
export function mailReadingFacts({
  canSend,
  reader,
}: {
  canSend: boolean | undefined;
  reader: string;
}): ReadingFact[] {
  return [
    {
      key: 'access',
      term: 'Gmail access',
      text:
        canSend === false
          ? 'The app can only read your mail. It never changes, moves or deletes anything in Gmail.'
          : 'The app can read your mail. It sends a mail only when you press Send on a reply. It never changes, moves or deletes anything in Gmail.',
    },
    {
      key: 'which',
      term: 'Which mail',
      text: 'Mail in your inbox, from your look-back, then new mail about once an hour. Promotions, Social and Spam are skipped without the AI, except LinkedIn under Social.',
    },
    {
      key: 'sort',
      term: 'To sort each mail',
      text: `The sender, subject, Gmail labels and Gmail's short preview (up to ${chars(MAIL_LIMITS.preview)}) go to the AI. It decides: job mail or not.`,
    },
    {
      key: 'job',
      term: 'Only for job mails',
      text: `Also the mail text (the first ${chars(MAIL_LIMITS.body)}), to find the company, the job, dates and what it asks of you. When a conversation waits on you, the new text of your own reply (up to ${chars(MAIL_LIMITS.reply)}).`,
    },
    {
      key: 'kept',
      term: 'What is kept',
      text: `For a job mail: the subject, sender, date and what the AI found. For other mail: only Gmail's id and the date, deleted after ${NOT_JOB_MAIL_KEPT_DAYS} days. The full text of your mails is never kept.`,
    },
    { key: 'ai', term: 'Which AI reads it', text: reader },
  ];
}
