import { useQuery } from '@tanstack/react-query';
import type { DashboardPeriod } from '../contracts/dashboard';
import { browserTimeZone } from '../lib/workspace';
import { api } from './client';

export const dashboardKey = (period: DashboardPeriod, timeZone: string) =>
  ['dashboard', period, timeZone] as const;

/** The Dashboard's numbers. They change only when mail is read, so the processing refresh asks. */
export function useDashboard(period: DashboardPeriod) {
  const timeZone = browserTimeZone();
  return useQuery({
    queryKey: dashboardKey(period, timeZone),
    queryFn: ({ signal }) => api.getDashboard({ period, timeZone }, { signal }),
  });
}
