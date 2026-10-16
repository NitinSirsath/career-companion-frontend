import type { AIModelPause, AISettingsResponse } from '../contracts/ai';
import type { GmailStatusResponse } from '../contracts/gmail';
import {
  accessCopy,
  accessPause,
  clock,
  isPauseReason,
  modelName,
  pauseTitle,
  providerName,
  waitingLine,
  type AccessCopy,
  type PauseReason,
} from './aiLabels';

/** The backend offers waiting mail a moment after a pause ends; the page looks just after that. */
export const PAUSE_END_MARGIN_MS = 5_000;

/** A new try to read the waiting mail: the user's click, or the end of a pause. */
export interface WaitingTry {
  /** The notice's title when the try started. */
  title: string;
  /** The end of the pause the try started in. Another state is the provider's answer. */
  pausedUntil: string | null;
}

export interface WaitingNotice extends AccessCopy {
  /** `ready`: "Read waiting mails now" can be clicked. `trying`: a try is running. */
  button: 'none' | 'ready' | 'trying';
  /** Lines under the text: another paused model, mail that needs the user's OK. */
  notes: string[];
}

/** The reason of a pause that passes by itself while mail waits for it; null in any other state. */
export function waitingPause(settings: AISettingsResponse): PauseReason | null {
  const { state, reason } = settings.access;
  return state === 'LIMITED' && isPauseReason(reason) && settings.waitingEmails > 0 ? reason : null;
}

/** What a try that ends the pause mail waits for is called: the pause's own title, or null. */
export function waitingTitle(settings: AISettingsResponse): string | null {
  const pause = waitingPause(settings) && accessPause(settings);
  return pause ? pauseTitle(settings, pause) : null;
}

/** The pause whose test mail of "Read waiting mails now" waits for the model's answer. */
export const runningTest = (settings: AISettingsResponse): AIModelPause | undefined =>
  settings.access.pauses.find((pause) => pause.test && pause.test.result === null);

/** True once the try has its answer: all waiting mail was read, or the access shows a new state. */
export const tryAnswered = (settings: AISettingsResponse, attempt: WaitingTry) =>
  settings.access.state === 'READY'
    ? settings.waitingEmails === 0
    : settings.access.resumesAt !== attempt.pausedUntil;

/** "Also paused: Gemini 3.5 Flash-Lite.", for the paused models the notice does not name. */
function alsoPaused(settings: AISettingsResponse, shown: string | null): string[] {
  const others = settings.access.pauses
    .filter((pause) => pause.model !== shown)
    .map((pause) => modelName(settings.provider, pause.model));
  return others.length ? [`Also paused: ${others.join(' and ')}.`] : [];
}

/** "1 email needs your OK": mails that got no answer in time after their tries. */
const needOk = (emails: number) =>
  `${emails} ${emails === 1 ? 'email needs' : 'emails need'} your OK`;
const retryThem = (emails: number) =>
  `Retry ${emails === 1 ? 'it' : 'them'} from the list below when you want.`;

/** Only the user's OK retries these mails: which model did not answer them, and when. */
function needsYourOkCopy(settings: AISettingsResponse): AccessCopy {
  const { provider } = settings;
  const { emails, model, lastTriedAt, tries } = settings.needsYourOk;
  const one = emails === 1;
  const it = one ? 'it' : 'them';
  const times = one && tries > 1 ? ` ${tries} times` : ' in time';
  const when = lastTriedAt
    ? `, ${one && tries <= 1 ? 'at' : 'the last at'} ${clock(lastTriedAt)}`
    : '';
  return {
    title: needOk(emails),
    detail: `${model ? modelName(provider, model) : providerName(provider)} did not answer ${it}${times}${when}. Career Companion stopped trying ${it} by itself. ${retryThem(emails)}`,
  };
}

/** A try that waits for its answer: the test mail of "Read waiting mails now", or another try. */
function tryingNotice(
  settings: AISettingsResponse,
  attempt: WaitingTry | null,
): WaitingNotice | null {
  const test = runningTest(settings);
  const title = test ? pauseTitle(settings, test) : attempt?.title;
  const runs = !!test || (settings.access.state === 'READY' && settings.waitingEmails > 0);
  if (!title || !runs) return null;
  return {
    title,
    detail: `Trying again now.${waitingLine(settings.waitingEmails)}`,
    button: 'trying',
    notes: alsoPaused(settings, test?.model ?? null),
  };
}

/** Mail that waits for the user's OK, unless a key or setup the user must fix comes first. */
const heldMail = ({ access, needsYourOk }: AISettingsResponse) =>
  access.state === 'NEEDS_ATTENTION' || access.state === 'NOT_SET_UP' ? 0 : needsYourOk.emails;

/**
 * What the AI notice shows, and whether it offers "Read waiting mails now". A try shows until its
 * answer comes. Mail that waits for the user's OK is never said to continue by itself: unless other
 * mail waits for AI, the notice is about that mail. The button is only for a pause that a new try
 * can end: a key, billing or model problem, a daily limit and a pause set by Career Companion all
 * need something else.
 */
export function waitingNotice(
  settings: AISettingsResponse,
  attempt: WaitingTry | null,
): WaitingNotice | null {
  const trying = tryingNotice(settings, attempt);
  if (trying) return trying;
  const { access } = settings;
  const copy = accessCopy(settings);
  const held = heldMail(settings);
  if (held && (!copy || !settings.waitingEmails))
    return { ...needsYourOkCopy(settings), button: 'none', notes: [] };
  if (!copy) return null;
  const notes = isPauseReason(access.reason) ? alsoPaused(settings, access.modelId) : [];
  if (held) notes.push(`${needOk(held)}. ${retryThem(held)}`);
  const readNow = !!waitingPause(settings) && access.failure?.quotaScope !== 'PER_DAY';
  return { ...copy, button: readNow ? 'ready' : 'none', notes };
}

/**
 * True when reloading the page cannot show anything new: no sync is running, AI cannot read mail
 * until a pause ends or the user fixes something, and no test mail waits for its answer.
 */
export const nothingCanChange = (gmail: GmailStatusResponse, ai: AISettingsResponse) =>
  gmail.syncStatus !== 'SYNCING' && ai.access.state !== 'READY' && !runningTest(ai);
