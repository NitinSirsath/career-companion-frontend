import { useEffect, useReducer } from 'react';
import {
  ErrorFilled,
  Information,
  Renew,
  WarningAltFilled,
  type CarbonIconType,
} from '@carbon/icons-react';
import type { AIModelPause } from '../../contracts/ai';
import type { EmailMessage } from '../../contracts/gmail';
import { analyzedBy } from '../../lib/aiLabels';
import { mailAIView, type MailAIInfo, type MailAIView } from '../../lib/mailAIStatus';
import { retryPause } from '../../lib/retryApproval';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const TONE_ICON: Record<MailAIView['tone'], { Icon: CarbonIconType; className: string } | null> = {
  neutral: null,
  warning: { Icon: WarningAltFilled, className: 'text-warning-icon' },
  error: { Icon: ErrorFilled, className: 'text-danger-text' },
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
        className="inline-flex size-6 cursor-help items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
      >
        <Information size={16} aria-hidden="true" className="text-text-secondary" />
      </TooltipTrigger>
      <TooltipContent className="overflow-hidden p-0">
        <div
          className={`px-3 py-2 text-[13px] font-semibold ${error ? 'bg-notice-error' : 'bg-notice-warning'}`}
        >
          {info.title}
        </div>
        <div className="flex flex-col gap-2 p-3 text-text-secondary">
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

/** "Read", with which provider and model read the mail on hover, focus or a tap. */
function AnalyzedTip({ label, badge }: { label: string; badge: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-border-focus">
        {badge}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
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
  const icon = TONE_ICON[view.tone];
  const analyzed =
    message.processingState === 'COMPLETED'
      ? analyzedBy(message.aiProcessingResult?.provider, message.aiProcessingResult?.model)
      : null;
  return (
    <>
      <div className="flex items-center gap-1.5 text-sm">
        {icon && <icon.Icon size={16} aria-hidden="true" className={icon.className} />}
        {analyzed ? <AnalyzedTip label={analyzed} badge={view.badge} /> : <span>{view.badge}</span>}
        {view.info && (
          <InfoTip info={view.info} question={view.question} error={view.tone === 'error'} />
        )}
      </div>
      {view.note && <p className="mt-1 text-xs text-text-secondary">{view.note}</p>}
      {message.processingStuck && (
        <p className="mt-1 text-xs text-text-secondary">
          Processing stopped before it finished. Use Manual Retry to continue.
        </p>
      )}
      {view.retry && (
        <Button
          variant="ghost"
          size="sm"
          // "Paused until about 12:30 PM tomorrow" wraps, so the table keeps its width.
          className={
            paused ? '-ml-3 h-auto min-h-8 py-1 text-left whitespace-normal' : '-ml-3 mt-1'
          }
          disabled={retryDisabled || !!paused}
          onClick={onRetry}
        >
          <Renew size={16} aria-hidden="true" />
          {paused?.label ?? 'Manual Retry'}
        </Button>
      )}
    </>
  );
}
