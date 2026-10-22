import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Flow, MachineLearningModel, User } from '@carbon/icons-react';
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
  USER: { icon: <User size={16} aria-hidden="true" />, label: 'Status set by you' },
  AI: {
    icon: <MachineLearningModel size={16} aria-hidden="true" />,
    label: 'Status set by the AI from a mail',
  },
  AUTOMATION: { icon: <Flow size={16} aria-hidden="true" />, label: 'Reported by your automation' },
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
  column('company', 'Company', (app) => (
    <div className="flex flex-col gap-0.5">
      <Link
        to="/applications/$id"
        params={{ id: app.id }}
        className={`${ROW_LINK_CLASS} font-semibold break-words`}
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
  )),
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
export function ApplicationsTable({ applications, ...rest }: ApplicationsTableProps) {
  return (
    <DataTable
      label="Applications"
      data={applications}
      columns={COLUMNS}
      getRowId={(app) => app.id}
      gridTemplate="minmax(220px,2fr) minmax(170px,1.3fr) 112px 128px minmax(200px,1.6fr) 32px"
      {...rest}
    />
  );
}
