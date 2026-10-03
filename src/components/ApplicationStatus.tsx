import { format } from 'date-fns';
import { Badge } from './ui/badge';
import type { ApplicationResponse, ApplicationStatus } from '../contracts/application';
import { STATUS_LABEL } from '../lib/statusLabels';


const VARIANT: Record<ApplicationStatus, 'secondary' | 'info' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  APPLIED: 'secondary',
  RECRUITER_CONTACT: 'info',
  ASSESSMENT: 'warning',
  INTERVIEW: 'info',
  OFFER: 'success',
  REJECTED: 'destructive',
  CLOSED: 'outline',
};

/** A valid null status is shown as a neutral unknown, never defaulted to Applied. */
export function StatusBadge({ status }: { status: ApplicationStatus | null }) {
  if (!status) return <Badge variant="outline">Status unknown</Badge>;
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const SOURCE_LABEL = { USER: 'Set by you', AI: 'Inferred by AI', UNKNOWN: 'No status yet' } as const;

/**
 * Effective status with provenance, shared by list and detail. The 'Applied · via automation'
 * badge appears only without user/AI status (ADR-0002 decision 8). Once status exists, it wins
 * the badge while a separate source label retains the submission fact.
 */
export function EffectiveStatus({ app, detailed = false }: { app: ApplicationResponse; detailed?: boolean }) {
  const viaAutomation = app.statusSource === 'UNKNOWN' && app.submittedVia === 'AUTOMATION';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {viaAutomation ? (
        <Badge variant="secondary">Application Submitted</Badge>
      ) : (
        <StatusBadge status={app.effectiveStatus} />
      )}
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
        <span className="text-xs text-text-secondary">· AI suggests {STATUS_LABEL[app.aiStatus]}</span>
      )}
    </div>
  );
}
