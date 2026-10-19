import { Button } from './button';
import { InlineNotification } from './notification';

interface SectionErrorProps {
  /** What could not load: "Could not load your job mails". */
  title: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * A part of the page that failed to load. It says what failed in plain words, never the raw
 * error, and offers "Try again".
 */
export function SectionError({ title, onRetry, className }: SectionErrorProps) {
  return (
    <InlineNotification
      kind="error"
      title={`${title}.`}
      className={className}
      action={
        onRetry && (
          <Button variant="ghost" size="sm" className="-my-1.5" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      The server did not answer. Nothing was changed.
    </InlineNotification>
  );
}
