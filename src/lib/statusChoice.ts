import { isApiError } from '../api/client';
import type { ApplicationStatus } from '../contracts/application';
import { STATUS_LABEL } from './statusLabels';
import { isOfflineError } from './offline';

/** The choice that clears the user's status, so the AI's status shows again. */
export const USE_AI = '__ai__';
export type Choice = ApplicationStatus | typeof USE_AI;

// After a save that may or may not have happened, the page reads the status again before it lets
// the user choose again. Nothing is ever sent twice by itself.
export type Phase =
  | { kind: 'idle' }
  | { kind: 'saving'; draft: ApplicationStatus | null }
  | { kind: 'failed' }
  | { kind: 'conflict'; wanted: ApplicationStatus | null }
  | { kind: 'reconciling' }
  | { kind: 'review' }
  | { kind: 'unknown' }
  | { kind: 'unavailable' };

/** "Offer", or "the AI's status" for the choice that clears the user's own. */
export const statusWords = (status: ApplicationStatus | null) =>
  status ? STATUS_LABEL[status] : "the AI's status";

/**
 * What a failed save means for the user. A save that may have happened is never sent again: the
 * page reads the status first ("reconcile"). Offline nothing was sent and the toast says so.
 */
export function phaseAfterError(
  error: unknown,
  wanted: ApplicationStatus | null,
): Phase | 'reconcile' {
  if (isOfflineError(error)) return { kind: 'idle' };
  if (isApiError(error) && error.status === 409) return { kind: 'conflict', wanted };
  if (isApiError(error) && error.status === 404) return { kind: 'unavailable' };
  if (isApiError(error) && !error.outcomeUncertain) return { kind: 'failed' };
  return 'reconcile';
}
