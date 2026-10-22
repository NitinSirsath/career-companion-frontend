import type { AIRetryApprovalDetails } from '../../contracts/email';
import { retryApprovalCopy } from '../../lib/retryApproval';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

/**
 * The user who pays approves exactly one more AI attempt for a step Career Companion will not try
 * again on its own: no answer after its last automatic try, or an uncertain or unusable outcome
 * (ADR-0001 decision 10). Nothing is retried without this confirmation.
 */
export function RetryAnywayDialog({
  details,
  pending,
  problem,
  onConfirm,
  onCancel,
}: {
  details: AIRetryApprovalDetails | null;
  pending: boolean;
  problem: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = details && retryApprovalCopy(details);
  return (
    <Dialog open={!!details} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retry with a possible extra charge?</DialogTitle>
        </DialogHeader>
        {copy && (
          <div className="space-y-3 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              {copy.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <p>{copy.text}</p>
            {copy.switched && <p className="font-medium">{copy.switched}</p>}
            {problem && (
              <p role="alert" className="text-status-error">
                {problem}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? 'Retrying…' : 'Retry anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
