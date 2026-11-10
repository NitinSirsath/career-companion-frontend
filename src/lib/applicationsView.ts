import { z } from 'zod';
import type { ApplicationFilters, RecentEvent } from '../contracts/application';
import { AUTOMATION_SUBMITTED } from './eventLabels';
import { mailDate, parseSender } from './mails';

/**
 * The two lists (owner, 10 Nov 2026): In progress leaves out NorthList Apply applications with no
 * company reply yet; NorthList Apply shows everything the user's agent sent.
 */
export const LIST_TABS = [
  { value: 'progress', label: 'In progress' },
  { value: 'apply', label: 'NorthList Apply' },
] as const;
export type ListTab = (typeof LIST_TABS)[number]['value'];

/** NorthList Apply tabs. A "we got your application" mail is not a reply: it waits. */
export const REPLY_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'replied', label: 'Replied' },
  { value: 'waiting', label: 'Waiting' },
] as const;
export type ReplyTab = (typeof REPLY_TABS)[number]['value'];

/** The status tabs of the In progress list, in job-search order. */
export const STATUS_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'RECEIVED', label: 'Applied' },
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
  view: z.enum(['apply']).optional().catch(undefined),
  reply: z.enum(['replied', 'waiting']).optional().catch(undefined),
  // SUBMITTED: the old "Sent by automation" tab; such a link opens NorthList Apply › Waiting.
  status: z
    .union([
      z.enum(STATUS_TABS.map((tab) => tab.value) as [StatusTab, ...StatusTab[]]),
      z.literal('SUBMITTED'),
    ])
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
  list: ListTab;
  /** The NorthList Apply tab. */
  reply: ReplyTab;
  /** The In progress status tab. */
  tab: StatusTab;
  archive: Archive;
  sort: Sort;
}

export const INITIAL_VIEW: DiscoveryView = {
  offset: 0,
  search: '',
  archive: 'active',
  sort: 'added_desc',
  list: 'progress',
  reply: 'ALL',
  tab: 'ALL',
};

export function viewFromSearch(search: ApplicationsSearch): DiscoveryView {
  const old = search.status === 'SUBMITTED';
  const list = search.view ?? (old ? 'apply' : 'progress');
  return {
    offset: search.offset ?? 0,
    search: search.q ?? '',
    list,
    reply: list === 'apply' ? (search.reply ?? (old ? 'waiting' : 'ALL')) : 'ALL',
    tab: list === 'progress' && search.status !== 'SUBMITTED' ? (search.status ?? 'ALL') : 'ALL',
    archive: search.archive ?? 'active',
    sort: search.sort ?? 'added_desc',
  };
}

/** The URL for a view: defaults are left out, so a plain list has a plain URL. */
export function searchFromView(view: DiscoveryView): ApplicationsSearch {
  return {
    q: view.search.trim() || undefined,
    view: view.list === 'apply' ? 'apply' : undefined,
    reply: view.list === 'apply' && view.reply !== 'ALL' ? view.reply : undefined,
    status: view.list === 'progress' && view.tab !== 'ALL' ? view.tab : undefined,
    archive: view.archive === 'active' ? undefined : view.archive,
    sort: view.sort === 'added_desc' ? undefined : view.sort,
    offset: view.offset > 0 ? view.offset : undefined,
  };
}

/** The server filters for the chosen list and its tab. */
export function listFilters(
  view: Pick<DiscoveryView, 'list' | 'reply' | 'tab'>,
): Pick<ApplicationFilters, 'group' | 'reply' | 'effectiveStatus'> {
  if (view.list === 'apply') {
    return { group: 'apply', ...(view.reply !== 'ALL' ? { reply: view.reply } : {}) };
  }
  if (view.tab === 'ALL') return { group: 'progress' };
  if (view.tab === 'RECEIVED') return { group: 'progress', effectiveStatus: 'APPLIED' };
  return { group: 'progress', effectiveStatus: view.tab };
}

/** The latest thing that happened, in plain words: "Mail from Arjun Mehta". */
export function activityLine(event: RecentEvent | null): { what: string; when: string } | null {
  if (!event) return null;
  const when = mailDate(event.sourceEmail?.receivedAt ?? event.recordedAt);
  if (event.type === AUTOMATION_SUBMITTED) return { what: 'Sent by NorthList Apply', when };
  const sender = event.sourceEmail?.sender;
  return { what: sender ? `Mail from ${parseSender(sender).name}` : 'A job mail', when };
}
