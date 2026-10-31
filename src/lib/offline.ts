/**
 * Offline pages (owner, 30 Oct 2026): pages already seen open offline, read-only, with a line
 * that says so. Nothing is written or sent offline: a change stops at once and is never sent
 * later. These are the plain rules; `offlineCopy.ts` keeps the copies.
 */
import { onlineManager, type Query } from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';
import { useSyncExternalStore } from 'react';

/** What a change pressed offline says. */
export const OFFLINE_CHANGE = "You're offline. Nothing was changed.";
/** What a reply sent offline says. The text stays in the reply box, as an unsent draft. */
export const OFFLINE_REPLY =
  "You're offline. Your reply was not sent. It stays here; send it when you're back online.";

/**
 * A change the API client refused because the device is offline; nothing reached the server.
 * (Read from the error, not by importing the client, which imports this file.)
 */
export const isOfflineError = (error: unknown) =>
  error instanceof Error && (error as { kind?: unknown }).kind === 'offline';

/**
 * Data the app shows around every page (the menu's AI status, the sync line, the app mode, the
 * test account check). Its missing copy never makes a page "not seen": the page shows without it.
 */
const SHELL_KEYS: readonly string[] = ['aiReading', 'gmailStatus', 'appMode', 'aiSettings'];

type PageQuery = Pick<Query, 'queryKey' | 'state'>;

const isShell = ({ queryKey }: PageQuery) =>
  SHELL_KEYS.includes(String(queryKey[0])) ||
  (queryKey[0] === 'auth' && queryKey[1] === 'currentUser');

/**
 * Offline, a page has no copy when one of its own queries has no data yet: it was never opened on
 * this device, or not in the last 7 days. `queries` are the queries the page uses now.
 */
export const pageHasNoCopy = (queries: readonly PageQuery[]) =>
  queries.some((query) => !isShell(query) && query.state.data === undefined);

/** When the oldest data on the page was fetched, or null when the page shows none. */
export function shownSince(queries: readonly PageQuery[]): number | null {
  const times = queries
    .filter((query) => !isShell(query) && query.state.data !== undefined)
    .map((query) => query.state.dataUpdatedAt)
    .filter((time) => time > 0);
  return times.length ? Math.min(...times) : null;
}

/** "Showing what was here at 10:42 AM." and the same with "yesterday" or "on Oct 28". */
export function shownSinceText(time: number): string {
  const date = new Date(time);
  const clock = format(date, 'h:mm a');
  if (isToday(date)) return `Showing what was here at ${clock}.`;
  if (isYesterday(date)) return `Showing what was here yesterday at ${clock}.`;
  return `Showing what was here on ${format(date, 'MMM d')} at ${clock}.`;
}

/** True while the device is online. The data library follows the browser's online events. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
}

/**
 * The data library assumes "online" until the browser says otherwise, so an app opened offline
 * would try every request. Start from what the browser knows.
 */
export function startFromBrowserOnlineState() {
  if (typeof navigator !== 'undefined') onlineManager.setOnline(navigator.onLine !== false);
}
