import { InfoIcon } from 'lucide-react';
import { isApiError } from '../../api/client';
import {
  useReanalysisPreview,
  useStartReanalysis,
  type ReanalysisTarget,
} from '../../api/reanalysis';
import type { ReanalysisPreview } from '../../contracts/reanalysis';
import { modelName } from '../../lib/aiLabels';
import { isOfflineError } from '../../lib/offline';
import { blockedText, whatIsRead } from '../../lib/reanalysis';
import { useIsPhone } from '../layout/useIsPhone';
import { AiIcon } from '../ui/ai-icon';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { InlineNotification } from '../ui/notification';
import { Sheet } from '../ui/sheet';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Why the start was refused, in the server's words. Offline the offline toast already said it. */
function refusal(error: unknown) {
  if (!error || isOfflineError(error)) return null;
  return isApiError(error) ? error.message : 'That did not go through. Try again.';
}

/** What it reads and what stays, the cost, what is left out, and why it cannot start now. */
function PreviewFacts({
  preview,
  application,
}: {
  preview: ReanalysisPreview;
  application: boolean;
}) {
  const blocked = preview.blocked && (
    <p className="flex items-start gap-1.5 text-text-secondary">
      <InfoIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
      {blockedText(preview.blocked)}
    </p>
  );
  // Nothing it could read now: only why.
  if (!preview.conversations) return blocked;
  return (
    <>
      <p>
        The AI reads {application ? 'their' : 'its'} {whatIsRead(preview)} again with today&rsquo;s
        rules. What you changed yourself stays as it is: your status, links, &ldquo;I did
        this&rdquo; and dates you set.
      </p>
      {preview.reader && (
        <p className="flex items-start gap-1.5 rounded-xl bg-surface-subtle px-3 py-2.5 text-text-secondary max-md:rounded-2xl">
          <AiIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium text-text-primary">
              {modelName(preview.reader.provider, preview.reader.model)}
            </span>{' '}
            · up to {plural(preview.maxReads, 'AI read')}
            {preview.readsLeft !== null && ` · ${preview.readsLeft} left today`}
          </span>
        </p>
      )}
      {preview.leftOut > 0 && (
        <p className="text-text-tertiary">
          {plural(preview.leftOut, 'more conversation is', 'more conversations are')} left out:
          reanalyzed a few minutes ago, still being read, or too long.
        </p>
      )}
      {preview.unfinishedMails > 0 && (
        <p className="text-text-tertiary">
          {plural(
            preview.unfinishedMails,
            'mail the AI never finished is',
            'mails the AI never finished are',
          )}{' '}
          not read; they wait for your OK on the AI page.
        </p>
      )}
      {blocked}
    </>
  );
}

/**
 * The confirm before a Reanalyze (owner, 19 Nov 2026, mock L2 and P2): what is read, that the
 * user's own changes stay, and its cost before any AI call: the model, the most AI reads it can
 * use and how many are left today. A small dialog on laptops; on phones a floating sheet with one
 * blue button, like every choice there.
 */
export function ReanalyzeDialog({
  target,
  open,
  onClose,
}: {
  target: ReanalysisTarget;
  open: boolean;
  onClose: () => void;
}) {
  const phone = useIsPhone();
  const preview = useReanalysisPreview(target, open);
  const start = useStartReanalysis(target);
  const application = target.kind === 'application';
  const close = () => {
    if (start.isPending) return;
    start.reset();
    onClose();
  };
  const go = () => start.mutate(undefined, { onSuccess: close });
  const facts = preview.data;
  const ready = !!facts && !facts.blocked;
  const title =
    application && facts
      ? `Reanalyze ${plural(facts.conversations, 'conversation')}?`
      : 'Reanalyze this conversation?';
  const refused = refusal(start.error);
  const body = (
    <div className="flex flex-col gap-3 text-sm leading-[1.45] max-md:text-[14.5px]">
      {preview.isPending && <p className="text-text-secondary">Checking what it would read…</p>}
      {preview.isError && !isOfflineError(preview.error) && (
        <p className="text-text-secondary">Could not check what it would read. Try again.</p>
      )}
      {facts && <PreviewFacts preview={facts} application={application} />}
      {refused && <InlineNotification kind="error">{refused}</InlineNotification>}
    </div>
  );
  if (phone)
    return (
      <Sheet open={open} onOpenChange={(value) => !value && close()} title="Reanalyze">
        {body}
        <button
          type="button"
          disabled={!ready || start.isPending}
          onClick={go}
          className="mt-1 h-12 cursor-pointer rounded-full bg-accent text-base font-semibold text-white transition-[opacity,scale] duration-200 active:scale-[1.02] disabled:cursor-default disabled:opacity-40"
        >
          {start.isPending ? 'Starting…' : 'Reanalyze'}
        </button>
      </Sheet>
    );
  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            The AI reads the mails and your replies again with today&rsquo;s rules.
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>
          <Button variant="secondary" disabled={start.isPending} onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ready} loading={start.isPending} onClick={go}>
            Reanalyze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
