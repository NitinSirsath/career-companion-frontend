import { Button } from '../ui/button';

interface ErrorStateProps {
  title: string;
  message: string;
  error?: unknown;
  showRetry?: boolean;
  showReload?: boolean;
  showDashboard?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
  onDashboard?: () => void;
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
  showDashboard = false,
  onRetry,
  onReload,
  onDashboard,
}: ErrorStateProps) {
  const details = import.meta.env.DEV && error !== undefined ? errorDetails(error) : null;

  return (
    <section role="alert" className="flex min-h-[280px] items-center justify-center p-6">
      <div className="w-full max-w-xl border border-border-default bg-surface p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        <p className="mt-3 text-sm text-text-secondary">{message}</p>

        {(showRetry || showReload || showDashboard) && (
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
            {showDashboard && onDashboard && (
              <Button type="button" variant="tertiary" onClick={onDashboard}>
                Go to Dashboard
              </Button>
            )}
          </div>
        )}

        {details && (
          <details className="mt-6 border border-border-default text-left">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              Details
            </summary>
            <div className="border-t border-border-default p-4 text-xs text-text-secondary">
              <p className="break-words">{details.message}</p>
              {details.stack && (
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono">{details.stack}</pre>
              )}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
