import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { InfoIcon } from 'lucide-react';
import { useAISettings } from '../../api/aiSettings';
import { runOpen, useReanalysisRun, type ReanalysisTarget } from '../../api/reanalysis';
import type { ReanalysisRun } from '../../contracts/reanalysis';
import { modelName } from '../../lib/aiLabels';
import { useOnline } from '../../lib/offline';
import { DOMAIN_QUERY_KEYS } from '../../lib/processingRefresh';
import { readingText, recentlyStopped, savedText, stoppedText } from '../../lib/reanalysis';
import { cn } from '../../lib/utils';
import { showToast } from '../ui/toast';

/** The model that reads now, by name, as the AI settings say. */
function useReaderName() {
  const settings = useAISettings();
  const models = settings.data?.models;
  return models ? modelName(settings.data?.provider, models.detailed.id) : 'AI';
}

/** When a run this page saw reading ends: every list reloads once, and a saved run says so. */
function useRunEnd(run: ReanalysisRun | null | undefined) {
  const queryClient = useQueryClient();
  const reading = useRef(false);
  useEffect(() => {
    if (runOpen(run)) {
      reading.current = true;
      return;
    }
    if (!reading.current || !run) return;
    reading.current = false;
    for (const key of DOMAIN_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
    if (run.state === 'SAVED') showToast(savedText(run));
  }, [run, queryClient]);
}

/**
 * Where a Reanalyze stands, in the AI's grey look (owner, 19 Nov 2026, mock L3, L5, P3, P5): while
 * it reads, "GPT-6 Luna · Reanalyzing" shimmers, one loader and nothing else moves; when it stops,
 * one grey line says why and that nothing changed. Offline the reading line is hidden: the saved
 * copy cannot tell whether it is still reading. One per page, so the toast shows once.
 */
export function ReanalyzeLine({
  target,
  className,
}: {
  target: ReanalysisTarget;
  className?: string;
}) {
  const online = useOnline();
  const { data: run } = useReanalysisRun(target);
  const reader = useReaderName();
  useRunEnd(run);
  if (runOpen(run))
    return online ? (
      <p className={cn('flex items-center gap-1.5 text-xs', className)}>
        <span className="text-text-secondary">{reader} ·</span>
        <span className="ai-shimmer">{readingText(target, run)}</span>
      </p>
    ) : null;
  if (run && recentlyStopped(run))
    return (
      <p className={cn('flex items-start gap-1.5 text-xs text-text-secondary', className)}>
        <InfoIcon size={13} aria-hidden="true" className="mt-px shrink-0" />
        {stoppedText(run)}
      </p>
    );
  return null;
}
