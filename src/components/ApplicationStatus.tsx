import { format } from 'date-fns';
import { Tag } from './ui/tag';
import type { ApplicationResponse, ApplicationStatus } from '../contracts/application';
import { STATUS_LABEL } from '../lib/statusLabels';
import { applicationTag, statusTag } from '../lib/statusTags';

/** A valid null status is shown as a neutral unknown, never defaulted to Applied. */
export function StatusBadge({ status }: { status: ApplicationStatus | null }) {
  const tag = statusTag(status);
  return <Tag color={tag.color}>{tag.label}</Tag>;
}

const SOURCE_LABEL = {
  USER: 'Set by you',
  AI: 'Inferred by AI',
  UNKNOWN: 'No status yet',
} as const;

/**
 * Effective status with provenance, shared by list and detail. The "Sent by automation" tag
 * appears only without user/AI status (ADR-0002 decision 8). Once status exists, it wins the tag
 * while a separate source label retains the submission fact.
 */
export function EffectiveStatus({
  app,
  detailed = false,
}: {
  app: ApplicationResponse;
  detailed?: boolean;
}) {
  const viaAutomation = app.statusSource === 'UNKNOWN' && app.submittedVia === 'AUTOMATION';
  const tag = applicationTag(app);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag color={tag.color}>{tag.label}</Tag>
      <span className="text-xs text-text-secondary">
        {viaAutomation ? 'Reported by your automation' : SOURCE_LABEL[app.statusSource]}
      </span>
      {!viaAutomation && app.submittedVia === 'AUTOMATION' && (
        <span className="text-xs text-text-secondary">Submitted via automation</span>
      )}
      {detailed && app.statusSource === 'USER' && (
        <span className="text-xs text-text-secondary">
          {app.userStatusSetAt
            ? `· confirmed ${format(new Date(app.userStatusSetAt), 'MMM d, yyyy h:mm a')}`
            : '· confirmation time unknown'}
        </span>
      )}
      {app.hasStatusConflict && app.aiStatus && (
        <span className="text-xs text-text-secondary">
          · AI suggests {STATUS_LABEL[app.aiStatus]}
        </span>
      )}
    </div>
  );
}
