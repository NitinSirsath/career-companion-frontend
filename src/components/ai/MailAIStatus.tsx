import { useEffect, useReducer } from 'react';
import { Information, Renew } from '@carbon/icons-react';
import type { AIModelPause } from '../../contracts/ai';
import type { EmailMessage } from '../../contracts/gmail';
import { mailAIView, type MailAIInfo, type MailAIView } from '../../lib/mailAIStatus';
import { retryPause } from '../../lib/retryApproval';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AnalyzedBy } from './AnalyzedBy';

const BADGE: Record<MailAIView['tone'], string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  warning: 'bg-status-warning-subtle text-status-warning border-status-warning/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
};

/** The (i): what happened, the step, and what happens next. A click or tap keeps it open. */
function InfoTip({
  info,
  question,
  error,
}: {
  info: MailAIInfo;
  question: string;
  error: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={question}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full cursor-help outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Information
          size={16}
          aria-hidden="true"
          className={error ? 'text-danger-text' : 'text-warning-icon'}
        />
      </TooltipTrigger>
      <TooltipContent className="p-0 overflow-hidden">
        <div
          className={`px-3 py-2 border-b font-semibold text-[13px] ${error ? 'bg-status-error-subtle border-status-error/20 text-status-error' : 'bg-status-warning-subtle border-status-warning/20 text-status-warning'}`}
        >
          {info.title}
        </div>
        <div className="p-3 flex flex-col gap-2 text-muted-foreground">
          <p>{info.text}</p>
          <div className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5">
            {info.step && (
              <>
                <span className="font-semibold">Step:</span>
                <span>{info.step}</span>
              </>
            )}
            <span className="font-semibold">{info.next.label}</span>
            <span>{info.next.text}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Renders again when `until` passes, so Manual Retry comes back when a pause ends. */
function useRenderAt(until: string | null) {
  const [renders, render] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!until) return;
    const timer = setTimeout(render, Date.parse(until) - Date.now());
    return () => clearTimeout(timer);
  }, [until, renders]);
}

/** The AI Status cell of a Gmail Sync row: a plain badge, the (i) that says why, Manual Retry. */
export function MailAIStatus({
  message,
  pauses,
  refusedUntil,
  retryDisabled,
  onRetry,
}: {
  message: EmailMessage;
  /** The running model pauses: for a mail that only waits for one, and to hold Manual Retry. */
  pauses: readonly AIModelPause[];
  /** The time a refused retry of this mail named: AI cannot be used until then. */
  refusedUntil: string | null;
  retryDisabled: boolean;
  onRetry: () => void;
}) {
  const view = mailAIView(message, pauses);
  const paused = retryPause(message.aiStatus, pauses, refusedUntil);
  useRenderAt(paused?.until ?? null);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE[view.tone]}`}
        >
          {view.badge}
        </span>
        {view.info && (
          <InfoTip info={view.info} question={view.question} error={view.tone === 'error'} />
        )}
      </div>
      {view.note && <p className="mt-1.5 text-xs text-muted-foreground">{view.note}</p>}
      {message.processingStuck && (
        <p className="text-sm mt-2 text-muted-foreground">
          Processing stopped before it finished. Use Manual Retry to continue.
        </p>
      )}
      {view.retry && (
        <Button
          variant="tertiary"
          size="sm"
          // "Paused until about 12:30 PM tomorrow" wraps, so the table keeps its width.
          className={paused ? 'mt-2 h-auto min-h-8 py-1 whitespace-normal text-left' : 'mt-2'}
          disabled={retryDisabled || !!paused}
          onClick={onRetry}
        >
          <Renew size={12} className="mr-1.5" aria-hidden="true" />
          {paused?.label ?? 'Manual Retry'}
        </Button>
      )}
      {message.processingState === 'COMPLETED' && (
        <AnalyzedBy
          provider={message.aiProcessingResult?.provider}
          model={message.aiProcessingResult?.model}
        />
      )}
    </>
  );
}
