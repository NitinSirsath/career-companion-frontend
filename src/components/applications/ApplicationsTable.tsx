import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRightIcon, UserIcon, WorkflowIcon } from 'lucide-react';
import { AiIcon } from '../ui/ai-icon';
import { format } from 'date-fns';
import type { ApplicationResponse } from '../../contracts/application';
import { activityLine } from '../../lib/applicationsView';
import { platformLabel } from '../../lib/eventLabels';
import { applicationTag, ARCHIVED_TAG } from '../../lib/statusTags';
import { JobLink } from '../automation/JobLink';
import { DataTable, ROW_LINK_CLASS } from '../ui/data-table';
import { OverflowMenu } from '../ui/menu';
import { Tag } from '../ui/tag';

const SOURCE: Record<'USER' | 'AI' | 'AUTOMATION', { icon: ReactNode; label: string }> = {
  USER: { icon: <UserIcon size={16} aria-hidden="true" />, label: 'Status set by you' },
  AI: {
    icon: <AiIcon size={16} aria-hidden="true" />,
    label: 'Status set by the AI from a mail',
  },
  AUTOMATION: {
    icon: <WorkflowIcon size={16} aria-hidden="true" />,
    label: 'From NorthList Apply',
  },
};

function sourceOf(app: ApplicationResponse): keyof typeof SOURCE | null {
  if (app.statusSource === 'USER' || app.statusSource === 'AI') return app.statusSource;
  return app.submittedVia === 'AUTOMATION' ? 'AUTOMATION' : null;
}

function StatusCell({ app }: { app: ApplicationResponse }) {
  const tag = applicationTag(app);
  const source = sourceOf(app);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag color={tag.color}>{tag.label}</Tag>
      {source && (
        <span className="text-text-secondary" title={SOURCE[source].label}>
          {SOURCE[source].icon}
          <span className="sr-only">{SOURCE[source].label}</span>
        </span>
      )}
      {app.archivedAt && <Tag color={ARCHIVED_TAG.color}>{ARCHIVED_TAG.label}</Tag>}
    </div>
  );
}

function RowMenu({ app }: { app: ApplicationResponse }) {
  const navigate = useNavigate();
  return (
    <OverflowMenu
      label={`Actions for ${app.companyName}`}
      actions={[
        {
          label: 'Open',
          onSelect: () => void navigate({ to: '/applications/$id', params: { id: app.id } }),
        },
      ]}
    />
  );
}

/** The applied date; for an automation row also the time its automation reported. */
function AppliedCell({ app }: { app: ApplicationResponse }) {
  if (!app.appliedAt) return <span className="text-text-tertiary">Unknown</span>;
  const applied = new Date(app.appliedAt);
  // The time is shown only when the applied date is the automation's own submission time.
  const timed =
    app.automation && new Date(app.automation.submittedAt).getTime() === applied.getTime();
  return (
    <div className="flex flex-col">
      <span>{format(applied, 'd MMM yyyy')}</span>
      {timed && <span className="text-xs text-text-secondary">{format(applied, 'h:mm a')}</span>}
    </div>
  );
}

const column = (
  id: string,
  header: ReactNode,
  cell: (app: ApplicationResponse) => ReactNode,
  meta?: ColumnDef<ApplicationResponse>['meta'],
): ColumnDef<ApplicationResponse> => ({
  id,
  header: () => header,
  cell: ({ row }) => cell(row.original),
  meta,
});

const COLUMNS: ColumnDef<ApplicationResponse>[] = [
  column(
    'company',
    'Company',
    (app) => (
      <div className="flex flex-col gap-0.5">
        <Link
          to="/applications/$id"
          params={{ id: app.id }}
          className={`${ROW_LINK_CLASS} break-words`}
        >
          {app.companyName}
        </Link>
        <span className="text-xs break-words text-text-secondary">
          {[app.jobTitle, app.location].filter(Boolean).join(' · ')}
        </span>
        {app.automation && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            {platformLabel(app.automation.platform)}
            <JobLink
              url={app.automation.jobUrl}
              label={`Open the job post for ${app.companyName} in a new tab`}
            />
          </span>
        )}
      </div>
    ),
    { count: true },
  ),
  column('status', 'Status', (app) => <StatusCell app={app} />),
  column(
    'todo',
    'To do',
    (app) =>
      app.pendingActionCount > 0 ? (
        <Tag color="yellow">{app.pendingActionCount} to do</Tag>
      ) : (
        <span className="text-text-tertiary">None</span>
      ),
    { phoneLabel: 'To do' },
  ),
  column('applied', 'Applied', (app) => <AppliedCell app={app} />, { phoneLabel: 'Applied' }),
  column(
    'activity',
    'Last activity',
    (app) => {
      const activity = activityLine(app.recentEvent);
      if (!activity) return <span className="text-text-tertiary">None yet</span>;
      return (
        <div className="flex flex-col">
          <span>{activity.what}</span>
          <span className="text-xs text-text-secondary">{activity.when}</span>
        </div>
      );
    },
    { phoneLabel: 'Last activity' },
  ),
  column('menu', <span className="sr-only">Actions</span>, (app) => <RowMenu app={app} />, {
    interactive: true,
    className: 'md:-my-1.5 md:justify-self-end',
  }),
];

interface ApplicationsTableProps {
  applications: ApplicationResponse[];
  loading?: boolean;
  empty?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
}

/** One row per application: company and role, status, open to-dos, applied date, latest news. */
/**
 * An application on a phone (owner, 13 Nov 2026): one row of the group with its company and
 * status, the role, and its to-dos and latest news.
 */
function PhoneApplicationCard({ app }: { app: ApplicationResponse }) {
  const tag = applicationTag(app);
  const activity = activityLine(app.recentEvent);
  const role = [app.jobTitle, app.location].filter(Boolean).join(' · ');
  return (
    <Link
      to="/applications/$id"
      params={{ id: app.id }}
      className="flex items-center gap-3 px-4 py-[11px] text-text-primary transition-colors duration-450 active:bg-surface-selected active:duration-0"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[17px] leading-[22px] font-semibold">
            {app.companyName}
          </span>
          <Tag color={tag.color}>{tag.label}</Tag>
        </span>
        {role && (
          <span className="text-[15px] leading-5 break-words text-text-secondary">{role}</span>
        )}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-text-secondary">
          {app.pendingActionCount > 0 && <Tag color="yellow">{app.pendingActionCount} to do</Tag>}
          {app.archivedAt && <Tag color={ARCHIVED_TAG.color}>{ARCHIVED_TAG.label}</Tag>}
          {activity && (
            <span>
              {activity.what} · {activity.when}
            </span>
          )}
        </span>
      </span>
      <ChevronRightIcon size={18} aria-hidden="true" className="shrink-0 text-text-tertiary" />
    </Link>
  );
}

export function ApplicationsTable({ applications, ...rest }: ApplicationsTableProps) {
  return (
    <DataTable
      label="Applications"
      data={applications}
      columns={COLUMNS}
      getRowId={(app) => app.id}
      gridTemplate="minmax(220px,2fr) minmax(170px,1.3fr) 112px 128px minmax(200px,1.6fr) 32px"
      phoneRow={(app) => <PhoneApplicationCard app={app} />}
      {...rest}
    />
  );
}
