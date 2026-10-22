/** After this long without an answer, the start-up screen says the server is waking up. */
export const WAKING_AFTER_MS = 5_000;
/** After this long it stops trying and says the server cannot be reached. */
export const GIVE_UP_AFTER_MS = 120_000;
/** The pause between two tries. */
export const RETRY_EVERY_MS = 3_000;
/** One try waits this long for an answer; after that it counts as no answer. */
export const TRY_TIMEOUT_MS = 10_000;

export type StartupStage = 'checking' | 'waking' | 'cannot-reach' | 'offline';

/** What the start-up screen says, from how long it has waited and whether the device is online. */
export function startupStage(waitedMs: number, online: boolean): StartupStage {
  if (!online) return 'offline';
  if (waitedMs >= GIVE_UP_AFTER_MS) return 'cannot-reach';
  return waitedMs >= WAKING_AFTER_MS ? 'waking' : 'checking';
}

/** The time waited so far, as on a clock: "0:07", "1:05". */
export function waitedLabel(waitedMs: number): string {
  const seconds = Math.floor(waitedMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
