import { Link } from '@tanstack/react-router';
import { needsGmailConnection } from '../../lib/mails';
import { Button } from '../ui/button';

/** Why live mail could not be read, with the way out: connect Gmail, or try again. */
export function MailboxProblem({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border border-border-default bg-surface-subtle p-4 space-y-3 text-sm"
    >
      <p>{error.message}</p>
      {needsGmailConnection(error) ? (
        <Link to="/gmail" className="inline-block underline">
          Open Gmail Sync
        </Link>
      ) : (
        <Button variant="tertiary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
