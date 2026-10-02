import { format } from 'date-fns';
import type { AIRetryApprovalDetails } from '../../contracts/email';
import { modelName, providerName } from '../../lib/aiLabels';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

const OPERATION = { classification: 'Relevance check', extraction: 'Detail extraction' } as Record<string, string>;
const REASON = {
  OUTCOME_UNKNOWN: 'its outcome is unknown, so it may already have been processed and charged',
  INVALID_OUTPUT: 'it returned a result Career Companion could not use',
  ATTEMPTS_EXHAUSTED: 'its attempts ran out',
} as const;

/**
 * The user who pays approves exactly one more AI attempt for an uncertain or unusable outcome
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
  const current = details?.currentProvider ?? null;
  const switched = details?.operations.some((op) => op.provider && current && op.provider !== current);
  return (
    <Dialog open={!!details} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retry with a possible extra charge?</DialogTitle>
        </DialogHeader>
        {details && (
          <div className="space-y-3 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              {details.operations.map((op) => (
                <li key={op.operation}>
                  {OPERATION[op.operation] ?? op.operation}
                  {op.provider ? ` was sent to ${providerName(op.provider)} · ${modelName(op.provider, op.model)}` : ''}
                  {op.attemptedAt ? ` on ${format(new Date(op.attemptedAt), 'MMM d, h:mm a')}` : ''}: {REASON[op.reason]}.
                </li>
              ))}
            </ul>
            <p>
              Retrying makes one more AI call on your {providerName(current)} account, which may be charged again.
              Career Companion never retries this on its own.
            </p>
            {switched && (
              <p className="font-medium">
                This retry uses {providerName(current)}, not the provider used before. The email will be sent to{' '}
                {providerName(current)}.
              </p>
            )}
            {problem && (
              <p role="alert" className="text-status-error">
                {problem}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="tertiary" onClick={onCancel} disabled={pending}>
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
