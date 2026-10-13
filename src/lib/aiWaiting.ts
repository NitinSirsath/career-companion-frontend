import type { AISettingsResponse } from '../contracts/ai';
import type { GmailStatusResponse } from '../contracts/gmail';
import {
  accessCopy,
  isPauseReason,
  pauseTitle,
  waitingLine,
  type AccessCopy,
  type PauseReason,
} from './aiLabels';

/** How long the notice says "Trying again now" when no answer shows. */
export const WAITING_TRY_WINDOW_MS = 60_000;
/** The backend offers waiting mail a moment after a pause ends; the page looks just after that. */
export const PAUSE_END_MARGIN_MS = 5_000;

/** A new try to read the waiting mail: the user's click, or the end of a pause. */
export interface WaitingTry {
  byUser: boolean;
  startedAt: string;
  /** The pause the try started in: why, and until when. Another end is the provider's answer. */
  reason: PauseReason;
  pausedUntil: string | null;
  /** Set after a minute with no answer: the notice stops saying "Trying again now". */
  expired: boolean;
}

export interface WaitingNotice extends AccessCopy {
  /** `ready`: "Read waiting mails now" can be clicked. `trying`: a try is running. */
  button: 'none' | 'ready' | 'trying';
}

/** The reason of a pause that passes by itself while mail waits for it; null in any other state. */
export function waitingPause(settings: AISettingsResponse): PauseReason | null {
  const { state, reason } = settings.access;
  return state === 'LIMITED' && isPauseReason(reason) && settings.waitingEmails > 0 ? reason : null;
}

/**
 * What the AI notice shows, and whether it offers "Read waiting mails now". The button is only
 * for a pause that a new try can end: a key, billing or model problem, the daily safety limit and
 * a pause set by Career Companion all need something else.
 */
export function waitingNotice(
  settings: AISettingsResponse,
  attempt: WaitingTry | null,
): WaitingNotice | null {
  const copy = accessCopy(settings);
  if (!copy) {
    // Ready again. While a try runs the notice stays and says so, instead of going and coming back.
    if (!attempt || attempt.expired || !settings.waitingEmails) return null;
    return {
      title: pauseTitle(settings.provider, attempt.reason),
      detail: `Trying again now.${waitingLine(settings.waitingEmails)}`,
      button: 'trying',
    };
  }
  if (!waitingPause(settings)) return { ...copy, button: 'none' };
  const answeredWithPause = attempt?.byUser && settings.access.resumesAt !== attempt.pausedUntil;
  return {
    ...(answeredWithPause ? (accessCopy(settings, attempt.startedAt) ?? copy) : copy),
    button: 'ready',
  };
}

/**
 * True when reloading the page cannot show anything new: no sync is running, and AI cannot read
 * mail until a pause ends or the user fixes something.
 */
export const nothingCanChange = (gmail: GmailStatusResponse, ai: AISettingsResponse) =>
  gmail.syncStatus !== 'SYNCING' && ai.access.state !== 'READY';
