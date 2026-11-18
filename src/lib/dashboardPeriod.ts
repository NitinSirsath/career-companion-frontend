import { useSyncExternalStore } from 'react';
import type { DashboardPeriod } from '../contracts/dashboard';

/*
 * The period picked on the phone's "Charts and rates" page (owner, 18 Nov 2026): Today's numbers
 * follow it after Back. Kept in memory only, like the lists' filters: a reload starts from the
 * address, then the default.
 */
let chosen: DashboardPeriod | null = null;
const listeners = new Set<() => void>();

export function choosePeriod(period: DashboardPeriod) {
  chosen = period;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The period last picked on a phone, or null when none was picked. */
export const useChosenPeriod = () => useSyncExternalStore(subscribe, () => chosen);
