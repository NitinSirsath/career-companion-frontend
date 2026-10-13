import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useReplySandboxMail } from '../../api/sandbox';
import {
  ReplySandboxMailRequestSchema,
  type ReplySandboxMailRequest,
} from '../../contracts/sandbox';
import { BODY_PROBLEM, sandboxProblem } from '../../lib/sandbox';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

/** The other person of the conversation writes; the sandbox never sends a mail as the user. */
const WRITER: ReplySandboxMailRequest['as'] = 'them';

/** The other person's next mail in the open conversation. `title` and `send` name that person. */
export function SandboxThreadMailForm({
  threadId,
  title,
  send,
}: {
  threadId: string;
  title: string;
  send: string;
}) {
  const bodyId = useId();
  const reply = useReplySandboxMail(threadId);
  const form = useForm<ReplySandboxMailRequest>({
    resolver: zodResolver(ReplySandboxMailRequestSchema),
    defaultValues: { as: WRITER, body: '' },
  });
  const onSubmit = form.handleSubmit((input) =>
    reply.mutate(input, { onSuccess: () => form.reset({ as: WRITER, body: '' }) }),
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Next mail from the other person"
      className="space-y-3 border border-border-strong p-4"
    >
      <p className="break-words text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        <Label htmlFor={bodyId}>Their mail</Label>
        <Textarea id={bodyId} rows={4} {...form.register('body')} />
        {form.formState.errors.body && <p className="text-sm text-status-error">{BODY_PROBLEM}</p>}
      </div>
      {reply.isError && (
        <p role="alert" className="text-sm text-status-error">
          {sandboxProblem(reply.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          It arrives in your inbox, in this conversation. The app sees it after the next sync.
        </p>
        <Button
          type="submit"
          disabled={reply.isPending}
          className="h-auto min-h-10 whitespace-normal"
        >
          {reply.isPending ? 'Sending…' : send}
        </Button>
      </div>
    </form>
  );
}
