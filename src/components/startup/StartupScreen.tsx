import type { ReactNode } from 'react';
import { WarningAlt, WifiOff, type CarbonIconType } from '@carbon/icons-react';
import { waitedLabel, type StartupStage } from '../../lib/startup';
import { Wordmark } from '../layout/Logo';
import { Button } from '../ui/button';

/** A short message under the name; the problems have an icon and "Try again". */
function Message({
  icon: Icon,
  title,
  children,
  onRetry,
}: {
  icon?: CarbonIconType;
  title: string;
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-8 flex w-full animate-fade-in flex-col items-center gap-2">
      {Icon && <Icon size={24} aria-hidden="true" className="text-warning-icon" />}
      <p className="text-base font-medium">{title}</p>
      <div className="flex max-w-95 flex-col items-center gap-1 text-sm text-text-secondary">
        {children}
      </div>
      {onRetry && (
        <Button className="mt-3 h-12 w-full justify-center sm:h-10 sm:w-auto" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * What shows while the app finds out who is signed in: the name and a thin moving line, never the
 * app. After a few seconds it says the server is waking up; after two minutes, or with no
 * network, it says what happened and offers "Try again".
 */
export function StartupScreen({
  stage,
  waitedMs,
  onRetry,
}: {
  stage: StartupStage;
  waitedMs: number;
  onRetry: () => void;
}) {
  const busy = stage === 'checking' || stage === 'waking';
  return (
    <main
      aria-busy={busy}
      className="flex min-h-screen items-center justify-center bg-background px-4 py-6 font-sans text-text-primary"
    >
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-110 flex-col items-center text-center"
      >
        <Wordmark size={28} />
        {busy && (
          <span
            aria-hidden="true"
            className="relative mt-7 h-0.5 w-40 overflow-hidden bg-border-subtle"
          >
            <span className="absolute inset-y-0 left-0 w-2/5 animate-startup-line bg-border-interactive motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-50" />
          </span>
        )}
        {stage === 'checking' && <span className="sr-only">Loading NorthList</span>}
        {stage === 'waking' && (
          <Message title="Waking up the server…">
            <p>
              The free server sleeps when nobody uses it. Starting it again takes about a minute.
              This page opens by itself when it is ready.
            </p>
            <p className="mt-1 text-xs tabular-nums">Waiting {waitedLabel(waitedMs)}</p>
          </Message>
        )}
        {stage === 'cannot-reach' && (
          <Message icon={WarningAlt} title="Can't reach the server" onRetry={onRetry}>
            <p>
              It did not answer for 2 minutes. It may still be starting, or it may be down. Try
              again in a moment.
            </p>
          </Message>
        )}
        {stage === 'offline' && (
          <Message icon={WifiOff} title="You're offline" onRetry={onRetry}>
            <p>Your device has no internet connection. Connect, then try again.</p>
          </Message>
        )}
      </div>
    </main>
  );
}
