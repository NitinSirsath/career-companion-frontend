import { z } from 'zod';
import type { ApplicationFilters, RecentEvent } from '../contracts/application';
import { AUTOMATION_SUBMITTED } from './eventLabels';
import { mailDate, parseSender } from './mails';

/** The status tabs of the Applications list, in job-search order. */
export const STATUS_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'RECEIVED', label: 'Applied' },
  { value: 'SUBMITTED', label: 'Sent by automation' },
  { value: 'RECRUITER_CONTACT', label: 'Recruiter contact' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

export type StatusTab = (typeof STATUS_TABS)[number]['value'];

export const ARCHIVE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All applications' },
] as const;

export const SORT_OPTIONS = [
  { value: 'added_desc', label: 'Newest added' },
  { value: 'applied_desc', label: 'Applied date: newest first' },
  { value: 'applied_asc', label: 'Applied date: oldest first' },
  { value: 'company_asc', label: 'Company: A to Z' },
] as const;

type Archive = (typeof ARCHIVE_OPTIONS)[number]['value'];
type Sort = (typeof SORT_OPTIONS)[number]['value'];

/** Everything the list shows is in the URL, so a reload or Back keeps the view. */
export const applicationsSearchSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z
    .enum(STATUS_TABS.map((tab) => tab.value) as [StatusTab, ...StatusTab[]])
    .optional()
    .catch(undefined),
  archive: z.enum(['archived', 'all']).optional().catch(undefined),
  sort: z.enum(['applied_desc', 'applied_asc', 'company_asc']).optional().catch(undefined),
  offset: z.number().int().min(0).optional().catch(undefined),
});
export type ApplicationsSearch = z.infer<typeof applicationsSearchSchema>;

export interface DiscoveryView {
  offset: number;
  search: string;
  tab: StatusTab;
  archive: Archive;
  sort: Sort;
}

export const INITIAL_VIEW: DiscoveryView = {
  offset: 0,
  search: '',
  archive: 'active',
  sort: 'added_desc',
  tab: 'ALL',
};

export function viewFromSearch(search: ApplicationsSearch): DiscoveryView {
  return {
    offset: search.offset ?? 0,
    search: search.q ?? '',
    tab: search.status ?? 'ALL',
    archive: search.archive ?? 'active',
    sort: search.sort ?? 'added_desc',
  };
}

/** The URL for a view: defaults are left out, so a plain list has a plain URL. */
export function searchFromView(view: DiscoveryView): ApplicationsSearch {
  return {
    q: view.search.trim() || undefined,
    status: view.tab === 'ALL' ? undefined : view.tab,
    archive: view.archive === 'active' ? undefined : view.archive,
    sort: view.sort === 'added_desc' ? undefined : view.sort,
    offset: view.offset > 0 ? view.offset : undefined,
  };
}

/** The server filters for a status tab. "Sent by automation" means no status yet. */
export function tabFilters(
  tab: StatusTab,
): Pick<ApplicationFilters, 'effectiveStatus' | 'submittedVia'> {
  if (tab === 'ALL') return {};
  if (tab === 'RECEIVED') return { effectiveStatus: 'APPLIED' };
  if (tab === 'SUBMITTED') return { effectiveStatus: 'UNKNOWN', submittedVia: 'AUTOMATION' };
  return { effectiveStatus: tab };
}

/** The latest thing that happened, in plain words: "Mail from Arjun Mehta". */
export function activityLine(event: RecentEvent | null): { what: string; when: string } | null {
  if (!event) return null;
  const when = mailDate(event.sourceEmail?.receivedAt ?? event.recordedAt);
  if (event.type === AUTOMATION_SUBMITTED) return { what: 'Sent by your automation', when };
  const sender = event.sourceEmail?.sender;
  return { what: sender ? `Mail from ${parseSender(sender).name}` : 'A job mail', when };
}
