import type { AIConnection, AISettingsResponse } from '../contracts/ai';
import { getCatalogProvider } from '../contracts/aiCatalog';
import { clock, type AccessCopy } from './aiLabels';

/**
 * The free AI (owner, 24 Oct 2026): "NorthList free AI" runs on NorthList's own
 * OpenRouter key, with GPT-6 Luna for both steps. The user has no key and no model choice; one
 * pause is shared by everyone on it, and nothing there is the user's to fix.
 */

export const FREE_AI = 'career-companion';

export const isFreeAI = (providerId: string | null | undefined) => providerId === FREE_AI;

/** The consent version the confirm dialog's text records. */
export const FREE_AI_CONSENT = getCatalogProvider(FREE_AI)?.disclosure.version ?? '';

/** The one model the free AI reads with, for both steps. */
export const FREE_AI_MODEL = getCatalogProvider(FREE_AI)?.models[0]?.displayName ?? '';

/** The server offers the free AI only while it can run. */
export const freeAIOffered = (settings: AISettingsResponse) =>
  settings.offeredProviders.includes(FREE_AI);

export const freeAIConnection = (settings: AISettingsResponse): AIConnection | null =>
  settings.connections.find((connection) => isFreeAI(connection.provider)) ?? null;

/**
 * The free AI as a backup (owner, 24 Oct 2026): while another provider reads the mail, the free AI
 * can be added next to it without switching, until it is added.
 */
export const freeAIBackupOffered = (settings: AISettingsResponse): boolean =>
  freeAIOffered(settings) &&
  !freeAIConnection(settings) &&
  settings.connections.some((connection) => connection.active);

/** The free AI in a list of providers: what it is, and the model it reads with. */
export const FREE_AI_NOTE = 'Free, shared by everyone. No key needed.';
export const freeAIModelLine = (model: string) => `${model} for both steps · about 200 mails a day`;

/** Providers the user connects with a key of their own. */
export const ownKeyProviders = (settings: AISettingsResponse): string[] =>
  settings.offeredProviders.filter((id) => !isFreeAI(id));

/** The confirm dialog's notices, approved by the owner with the mock (24 Oct 2026). */
export const FREE_AI_FACTS: readonly { term: string; text: string }[] = [
  {
    term: 'What is sent',
    text: 'For each new mail: the sender, subject, Gmail labels and a short preview (up to 1,000 characters). For job mails, also the mail text (up to 8,000 characters). Nothing else from your mailbox.',
  },
  {
    term: 'Who reads it',
    text: "OpenRouter, on NorthList's account. It passes each mail to GPT-6 Luna on Microsoft Azure servers in the US or Europe. NorthList asks for servers that keep nothing, so they cannot train on your mail.",
  },
  {
    term: 'Shared',
    text: 'Everyone on the free AI shares it. When it is busy, it pauses for a few minutes and your mails wait in line. They are read by themselves later. None are lost.',
  },
  { term: 'Daily limit', text: 'About 200 mails a day. Mails over that are read the next day.' },
  {
    term: 'Budget',
    text: 'If the free budget runs out, the free AI pauses for everyone. You can connect your own key at any time.',
  },
];

export const FREE_AI_BANNER =
  'so it can be slower and sometimes pauses for a few minutes. For faster reading, connect your own key.';

export const FREE_AI_LIMIT_NOTE =
  'The free AI reads about 200 mails a day for you. A job mail takes 2 calls. Mails over the limit are read the next day.';

/** "Your 12 new mails are waiting", or "New mails wait" when none is waiting yet. */
const waiting = (count: number) => {
  if (!count) return 'New mails wait';
  return `Your ${count} new ${count === 1 ? 'mail is' : 'mails are'} waiting`;
};

const OWN_KEY = { label: 'Connect your own key', to: '/ai' } as const;

/**
 * The free AI's own waits: its pause shared by everyone (busy, budget used up, a problem on
 * NorthList's side) or the free AI switched off. Null for any other state.
 */
export function freeAICopy(settings: AISettingsResponse): AccessCopy | null {
  const { access, waitingEmails } = settings;
  const until = access.resumesAt ? ` until about ${clock(access.resumesAt)}` : '';
  switch (access.reason) {
    case 'FREE_AI_BUSY':
      return {
        title: 'The free AI is busy right now.',
        detail: `OpenRouter asked NorthList to slow down, so the free AI is paused for everyone${until}. ${waiting(waitingEmails)} in line and will be read by themselves. Nothing is lost.`,
        fix: OWN_KEY,
      };
    case 'FREE_AI_BUDGET':
      return {
        title: "The free AI is paused: this month's free budget is used up.",
        detail: `${waiting(waitingEmails)} and none are lost. They are read when the free AI is back, which can take a while. To keep going now, connect your own key.`,
        fix: OWN_KEY,
      };
    case 'FREE_AI_PROBLEM':
      return {
        title: "The free AI is paused: a problem on NorthList's side.",
        detail: `We have been told and are fixing it. There is nothing for you to do. ${waiting(waitingEmails)} and none are lost. To keep going now, connect your own key.`,
        fix: OWN_KEY,
      };
    case 'FREE_AI_OFF':
      return {
        title: 'The free AI is switched off for now.',
        detail: `NorthList turned the free AI off. ${waiting(waitingEmails)} and none are lost. To keep going now, connect your own key.`,
        fix: OWN_KEY,
      };
    default:
      return null;
  }
}
