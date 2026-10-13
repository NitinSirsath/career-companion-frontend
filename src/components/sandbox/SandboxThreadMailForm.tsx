import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useReplySandboxMail } from '../../api/sandbox';
import {
  ReplySandboxMailRequestSchema,
  type ReplySandboxMailRequest,
} from '../../contracts/sandbox';
import { BODY_PROBLEM, sandboxProblem } from '../../lib/sandbox';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

export interface ThreadMailCopy {
  /** Accessible name of the form. */
  form: string;
  /** Shown above the text box when the writer is not the user. */
  title?: string;
  label: string;
  hint: string;
  send: string;
}

/**
 * One mail written into the open conversation, by the user or by the other person. `onClose` is
 * given for a box the tester opened: it adds Cancel, and the box closes after the mail is sent.
 */
export function SandboxThreadMailForm({
  threadId,
  as,
  copy,
  onClose,
}: {
  threadId: string;
  as: ReplySandboxMailRequest['as'];
  copy: ThreadMailCopy;
  onClose?: () => void;
}) {
  const bodyId = useId();
  const reply = useReplySandboxMail(threadId);
  const form = useForm<ReplySandboxMailRequest>({
    resolver: zodResolver(ReplySandboxMailRequestSchema),
    defaultValues: { as, body: '' },
  });
  const onSubmit = form.handleSubmit((input) =>
    reply.mutate(input, {
      onSuccess: () => {
        form.reset({ as, body: '' });
        onClose?.();
      },
    }),
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={copy.form}
      className={cn('space-y-3 border border-border-strong p-4', onClose && 'bg-surface-subtle')}
    >
      {copy.title && <p className="break-words text-sm font-semibold">{copy.title}</p>}
      <div className="space-y-2">
        <Label htmlFor={bodyId}>{copy.label}</Label>
        <Textarea id={bodyId} rows={4} {...form.register('body')} />
        {form.formState.errors.body && <p className="text-sm text-status-error">{BODY_PROBLEM}</p>}
      </div>
      {reply.isError && (
        <p role="alert" className="text-sm text-status-error">
          {sandboxProblem(reply.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{copy.hint}</p>
        <div className="flex flex-wrap gap-3">
          {onClose && (
            <Button type="button" variant="tertiary" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={reply.isPending}
            className="h-auto min-h-10 whitespace-normal"
          >
            {reply.isPending ? 'Sending…' : copy.send}
          </Button>
        </div>
      </div>
    </form>
  );
}
