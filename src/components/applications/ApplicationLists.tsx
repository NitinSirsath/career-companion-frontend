import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { FileTextIcon, SearchXIcon, WorkflowIcon } from 'lucide-react';
import { useSandboxMailbox } from '../../api/appMode';
import { api } from '../../api/client';
import { useGmailStatus } from '../../api/gmail';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { applicationGroupsKey } from '../../lib/applicationCache';
import {
  LIST_TABS,
  REPLY_TABS,
  type DiscoveryView,
  type ListTab,
  type ReplyTab,
} from '../../lib/applicationsView';
import { EMPTY_ACTION, EMPTY_ACTION_QUIET, EmptyState } from '../ui/empty-state';
import { Tabs } from '../ui/tabs';
import { ReplyBar } from './ReplyBar';

/**
 * The two Applications lists (owner, 10 Nov 2026): In progress with its status tabs, and NorthList
 * Apply with the reply bar and its Replied / Waiting tabs. The counts follow the visibility filter
 * only, not the search or the tab.
 */
export function ApplicationListTabs({
  view,
  onChange,
}: {
  view: Pick<DiscoveryView, 'list' | 'reply' | 'tab' | 'archive'>;
  onChange: (changes: Partial<DiscoveryView>) => void;
}) {
  const { data: groups } = useQuery({
    queryKey: applicationGroupsKey(view.archive),
    queryFn: ({ signal }) => api.getApplicationGroups(view.archive, { signal }),
  });
  // Nothing sent yet: no "0 of 0 replied" bar and no empty filters, only the empty list's next step.
  const nothingSent = groups?.apply.total === 0;
  return (
    <>
      <Tabs<ListTab>
        label="Application lists"
        look="underline"
        value={view.list}
        onValueChange={(next) => onChange({ list: next, tab: 'ALL', reply: 'ALL' })}
        items={LIST_TABS.map((item) => ({
          ...item,
          count: groups && (item.value === 'progress' ? groups.inProgress : groups.apply.total),
        }))}
      />
      {view.list === 'progress'
        ? // Phones pick the status in the top bar's filter menu (owner, 13 Nov 2026), laptops in
          // the toolbar's segmented control (`LaptopStatusFilter`, 18 Nov 2026).
          null
        : !nothingSent && (
            <div className="space-y-6 max-md:space-y-4">
              {groups && <ReplyBar replied={groups.apply.replied} total={groups.apply.total} />}
              <Tabs<ReplyTab>
                label="Replies"
                value={view.reply}
                onValueChange={(next) => onChange({ reply: next })}
                items={REPLY_TABS.map((item) => ({
                  ...item,
                  count:
                    groups &&
                    (item.value === 'ALL' ? groups.apply.total : groups.apply[item.value]),
                }))}
                phoneLook="chips"
              />
              <p className="text-sm text-text-secondary">
                Everything NorthList Apply sent. A job moves to In progress once the company
                replies. Submissions waiting for a match are in{' '}
                <Link to="/automation">NorthList Apply review</Link>.
              </p>
            </div>
          )}
    </>
  );
}

/** What an empty list says: no match for the filters, or nothing in this list yet. */
export function ApplicationsEmpty({
  list,
  hasFilters,
  onClear,
}: {
  list: ListTab;
  hasFilters: boolean;
  onClear: () => void;
}) {
  const sandbox = useSandboxMailbox();
  const gmail = useGmailStatus();
  if (hasFilters) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="No matching applications"
        action={
          <button type="button" className={EMPTY_ACTION_QUIET} onClick={onClear}>
            Clear filters
          </button>
        }
      >
        Try other words, another tab, or clear the filters.
      </EmptyState>
    );
  }
  if (list === 'apply') {
    return (
      <EmptyState
        icon={WorkflowIcon}
        title="Nothing from NorthList Apply yet"
        action={
          <Link to="/automation" search={{ tab: 'setup' }} className={EMPTY_ACTION_QUIET}>
            Set up NorthList Apply
          </Link>
        }
      >
        Each job your own agent applies to shows here.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={FileTextIcon}
      title="No applications yet"
      action={
        gmail.data?.connected === false && (
          <Link to="/gmail" className={EMPTY_ACTION}>
            {gmailConnectionCopy(sandbox, gmail.data.status).connect}
          </Link>
        )
      }
    >
      NorthList adds one when it finds an application in your mails, with where it stands.
    </EmptyState>
  );
}
