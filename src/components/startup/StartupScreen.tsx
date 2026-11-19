import { useEffect, type ReactNode } from 'react';
import { TriangleAlertIcon, WifiOffIcon, type LucideIcon } from 'lucide-react';
import { waitedLabel, type StartupStage } from '../../lib/startup';
import { holdStartupMark, releaseStartupMark } from '../../lib/startupMark';
import { Button } from '../ui/button';

/** A short message under the mark; the problems have an icon and "Try again". */
function Message({
  icon: Icon,
  title,
  busy = false,
  children,
  onRetry,
}: {
  icon?: LucideIcon;
  title: string;
  busy?: boolean;
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="flex w-full animate-page-in flex-col items-center gap-1.5">
      {Icon && <Icon size={24} aria-hidden="true" className="mb-0.5 text-warning-icon" />}
      <p className={busy ? 'ai-shimmer text-base font-semibold' : 'text-base font-semibold'}>
        {title}
      </p>
      <div className="flex max-w-80 flex-col items-center gap-1 text-sm text-text-secondary">
        {children}
      </div>
      {onRetry && (
        <Button
          className="mt-3 h-12 w-full max-w-80 justify-center sm:h-10 sm:w-auto"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * What shows while the app finds out who is signed in. The moving mark comes from `index.html`
 * and stays in the middle; this screen holds it, makes it still when nothing loads, and puts the
 * words under it. After a few seconds it says the server is waking up; after two minutes, or with
 * no network, it says what happened and offers "Try again". When it closes, the mark fades away.
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
  useEffect(() => holdStartupMark(!busy), [busy]);
  useEffect(() => () => releaseStartupMark(), []);

  return (
    <main
      aria-busy={busy}
      className="startup-below flex min-h-dvh flex-col items-center bg-background px-4 pb-6 font-sans text-text-primary"
    >
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-110 flex-col items-center text-center"
      >

        {stage === 'checking' && <span className="sr-only">Loading NorthList</span>}
        {stage === 'waking' && (
          <Message title="Waking up the server" busy>
            <p>
              The free server sleeps when nobody uses it. It takes about a minute, then NorthList
              opens by itself.
            </p>
            <p className="mt-1 text-xs tabular-nums">Waiting {waitedLabel(waitedMs)}</p>
          </Message>
        )}
        {stage === 'cannot-reach' && (
          <Message icon={TriangleAlertIcon} title="Can't reach the server" onRetry={onRetry}>
            <p>No answer for 2 minutes. It may still be starting, or it may be down.</p>
          </Message>
        )}
        {stage === 'offline' && (
          <Message icon={WifiOffIcon} title="You're offline" onRetry={onRetry}>
            <p>Connect to the internet, then try again.</p>
          </Message>
        )}
      </div>
    </main>
  );
}
