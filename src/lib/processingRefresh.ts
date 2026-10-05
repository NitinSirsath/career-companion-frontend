// Bounded refresh window for delayed background processing (Sprint 5 S5-04).
// Ingestion can finish before AI/matching; while the window is open the authenticated shell
// refreshes domain queries so cached list/detail/timeline/action views catch up across SPA
// navigation. The window always expires: there is no permanent polling.

export const PROCESSING_REFRESH_WINDOW_MS = 120_000;
export const PROCESSING_REFRESH_INTERVAL_MS = 4_000;
export const DOMAIN_QUERY_KEYS = [
  'gmailStatus',
  'gmailMessages',
  'applications',
  'application',
  'application-events',
  'application-actions',
  'actions',
  'workspace',
  'agenda',
  'unmatched-emails',
  'ambiguous-emails',
  'aiSettings', // waiting count and access state change as emails are processed
] as const;

let refreshUntil = 0;
const listeners = new Set<() => void>();

export function startProcessingRefresh(durationMs = PROCESSING_REFRESH_WINDOW_MS) {
  refreshUntil = Math.max(refreshUntil, Date.now() + durationMs);
  listeners.forEach((listener) => listener());
}

export function getProcessingRefreshUntil() {
  return refreshUntil;
}

export function subscribeProcessingRefresh(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper: close any open window. */
export function resetProcessingRefresh() {
  refreshUntil = 0;
  listeners.forEach((listener) => listener());
}
