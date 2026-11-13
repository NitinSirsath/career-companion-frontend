import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { applicationGroupsKey } from '../../lib/applicationCache';
import {
  LIST_TABS,
  REPLY_TABS,
  STATUS_TABS,
  type DiscoveryView,
  type ListTab,
  type ReplyTab,
  type StatusTab,
} from '../../lib/applicationsView';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
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
  const phone = useIsPhone();
  const { data: groups } = useQuery({
    queryKey: applicationGroupsKey(view.archive),
    queryFn: ({ signal }) => api.getApplicationGroups(view.archive, { signal }),
  });
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
      {view.list === 'progress' ? (
        // Phones pick the status in the top bar's filter menu (owner, 13 Nov 2026).
        !phone && (
          <Tabs<StatusTab>
            label="Status"
            value={view.tab}
            onValueChange={(next) => onChange({ tab: next })}
            items={STATUS_TABS}
            phoneLook="chips"
          />
        )
      ) : (
        <div className="space-y-6 max-md:space-y-4">
          {groups && <ReplyBar replied={groups.apply.replied} total={groups.apply.total} />}
          <Tabs<ReplyTab>
            label="Replies"
            value={view.reply}
            onValueChange={(next) => onChange({ reply: next })}
            items={REPLY_TABS.map((item) => ({
              ...item,
              count:
                groups && (item.value === 'ALL' ? groups.apply.total : groups.apply[item.value]),
            }))}
            phoneLook="chips"
          />
          <p className="text-sm text-text-secondary">
            Everything NorthList Apply sent. A job moves to In progress once the company replies.
            Submissions waiting for a match are in{' '}
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
  if (hasFilters) {
    return (
      <EmptyState
        title="No matching applications"
        action={
          <Button variant="ghost" className="-ml-4" onClick={onClear}>
            Clear all filters
          </Button>
        }
      >
        Try changing the search, the tab or what is shown.
      </EmptyState>
    );
  }
  if (list === 'apply') {
    return (
      <EmptyState title="Nothing sent by NorthList Apply yet">
        Each job your agent applies to appears here. Set it up on the{' '}
        <Link to="/automation" search={{ tab: 'setup' }}>
          NorthList Apply
        </Link>{' '}
        page.
      </EmptyState>
    );
  }
  return (
    <EmptyState title="No applications yet">
      They appear here when the app finds one in your mails, or when NorthList Apply sends one and
      the company replies. Submissions waiting for a match are in{' '}
      <Link to="/automation">NorthList Apply</Link>.
    </EmptyState>
  );
}
