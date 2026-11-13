import type { AISettingsResponse } from '../contracts/ai';
import type { AlertState } from './alerts';
import { providerName } from './aiLabels';
import { shortSyncTime } from './mailsStatus';

/** The phone Settings tab's grey words at the right of a row (owner, 13 Nov 2026). */

/** Gmail sync: when mail last came in, or what is missing. */
export function gmailValue(status: { connected: boolean; lastSyncedAt?: unknown } | undefined) {
  if (!status) return undefined;
  if (!status.connected) return 'Not connected';
  if (typeof status.lastSyncedAt !== 'string') return 'Not synced yet';
  return shortSyncTime(status.lastSyncedAt);
}

/** AI providers: which one reads the mail, or that none does yet. */
export function aiValue(settings: AISettingsResponse | undefined) {
  if (!settings) return undefined;
  const state = settings.access.state;
  if (state === 'NOT_SET_UP') return 'Not set up';
  if (state === 'NEEDS_ATTENTION') return 'Needs you';
  return providerName(settings.provider);
}

/** Alerts that cannot be switched here: the Account page says why and what to do. */
export const ALERT_WORDS: Partial<Record<AlertState, string>> = {
  blocked: 'Blocked',
  'home-screen-first': 'Home Screen first',
  unsupported: 'Not on this browser',
};
