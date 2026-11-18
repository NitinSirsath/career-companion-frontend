import { Fragment, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { UserIcon, WorkflowIcon } from 'lucide-react';
import { AiIcon } from '../ui/ai-icon';
import { format } from 'date-fns';
import { useNextSteps, type NextStep } from '../../api/nextSteps';
import type { ApplicationResponse } from '../../contracts/application';
import { activityLine } from '../../lib/applicationsView';
import { platformLabel } from '../../lib/eventLabels';
import { shortAgo } from '../../lib/shortAgo';
import { cn } from '../../lib/utils';
import { applicationTag, ARCHIVED_TAG } from '../../lib/statusTags';
import { JobLink } from '../automation/JobLink';
import { DataTable, ROW_LINK_CLASS } from '../ui/data-table';
import { OverflowMenu } from '../ui/menu';
import { Tag } from '../ui/tag';
import { Ring, StatusRing } from '../ui/ring';

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
      <StatusRing look={tag} />
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
  /** The list's filters and page: rows that leave shrink away, new rows grow in. */
  motionKey?: string;
}

/**
 * A phone row's third line: the status, the open to-dos (a red "Past due" in their place when the
 * next step is late, mock screen 5), then the next step, or the latest news when nothing is open.
 */
function statusLine(app: ApplicationResponse, step: NextStep | undefined): ReactNode[] {
  const parts: ReactNode[] = [applicationTag(app).label];
  if (step?.pastDue) parts.push(<span className="font-medium text-late">Past due</span>);
  else if (app.pendingActionCount > 0)
    parts.push(
      <span className="font-medium text-text-primary">{app.pendingActionCount} to do</span>,
    );
  if (app.archivedAt) parts.push(ARCHIVED_TAG.label);
  const news = step?.text ?? activityLine(app.recentEvent)?.what;
  if (news) parts.push(news);
  return parts;
}

/**
 * An application on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 5): a plain row
 * that starts with the status ring and the company, the latest date at the right; the role and
 * place; then the status, the open to-dos (red "Past due" when the next step is late) and the next
 * step, or the latest news when nothing is open. Closed ones are faded.
 */
function PhoneApplicationRow({ app }: { app: ApplicationResponse }) {
  const role = [app.jobTitle, app.location].filter(Boolean).join(' · ');
  const ended =
    !!app.archivedAt || app.effectiveStatus === 'REJECTED' || app.effectiveStatus === 'CLOSED';
  const when = app.recentEvent?.sourceEmail?.receivedAt ?? app.recentEvent?.recordedAt;
  const parts = statusLine(app, useNextSteps().steps?.get(app.id));
  return (
    <Link
      to="/applications/$id"
      params={{ id: app.id }}
      className={cn(
        'grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 border-b border-border-subtle px-[18px] py-[11px] text-text-primary transition-colors duration-450 active:bg-surface-selected active:duration-0',
        ended && 'opacity-55',
      )}
    >
      <Ring kind={applicationTag(app).ring} className="mt-[3px]" />
      <span className="flex min-w-0 flex-col gap-px">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-phone-row font-semibold">{app.companyName}</span>
          <span className="shrink-0 text-[13px] text-text-tertiary">
            {shortAgo(when ?? app.updatedAt)}
          </span>
        </span>
        {role && <span className="truncate text-phone-sub text-text-secondary">{role}</span>}
        <span className="truncate text-phone-sub text-text-secondary">
          {parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && ' · '}
              {part}
            </Fragment>
          ))}
        </span>
      </span>
    </Link>
  );
}

/** One row per application: company and role, status, open to-dos, applied date, latest news. */
export function ApplicationsTable({ applications, ...rest }: ApplicationsTableProps) {
  return (
    <DataTable
      label="Applications"
      data={applications}
      columns={COLUMNS}
      getRowId={(app) => app.id}
      gridTemplate="minmax(220px,2fr) minmax(170px,1.3fr) 112px 128px minmax(200px,1.6fr) 32px"
      phoneRow={(app) => <PhoneApplicationRow app={app} />}
      phonePlain
      {...rest}
    />
  );
}
