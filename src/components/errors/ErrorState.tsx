import { useState } from 'react';
import { ChevronDown } from '@carbon/icons-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';

interface ErrorStateProps {
  title: string;
  message: string;
  error?: unknown;
  showRetry?: boolean;
  showReload?: boolean;
  showHome?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
  onHome?: () => void;
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  return { message: String(error), stack: undefined };
}

export function ErrorState({
  title,
  message,
  error,
  showRetry = false,
  showReload = false,
  showHome = false,
  onRetry,
  onReload,
  onHome,
}: ErrorStateProps) {
  const details = import.meta.env.DEV && error !== undefined ? errorDetails(error) : null;

  return (
    <section role="alert" className="flex min-h-[280px] items-center justify-center p-6">
      <div className="w-full max-w-xl border border-border-default bg-surface p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        <p className="mt-3 text-sm text-text-secondary">{message}</p>

        {(showRetry || showReload || showHome) && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {showRetry && onRetry && (
              <Button type="button" variant="primary" onClick={onRetry}>
                Retry
              </Button>
            )}
            {showReload && onReload && (
              <Button type="button" variant="secondary" onClick={onReload}>
                Reload page
              </Button>
            )}
            {showHome && onHome && (
              <Button type="button" variant="tertiary" onClick={onHome}>
                Go to Mails
              </Button>
            )}
          </div>
        )}

        {details && <ErrorDetails details={details} />}
      </div>
    </section>
  );
}

/** The error's own message and stack, folded, for local development only. */
function ErrorDetails({ details }: { details: ReturnType<typeof errorDetails> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border border-border-default text-left">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
      >
        Details
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn('transition-transform duration-150 ease-standard', open && 'rotate-180')}
        />
      </button>
      <Collapse open={open}>
        <div className="border-t border-border-default p-4 text-xs text-text-secondary">
          <p className="break-words">{details.message}</p>
          {details.stack && (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono">
              {details.stack}
            </pre>
          )}
        </div>
      </Collapse>
    </div>
  );
}
