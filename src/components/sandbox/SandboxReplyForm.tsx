import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useReplySandboxMail } from '../../api/sandbox';
import {
  ReplySandboxMailRequestSchema,
  type ReplySandboxMailRequest,
} from '../../contracts/sandbox';
import { parseSender } from '../../lib/mails';
import { BODY_PROBLEM, sandboxProblem } from '../../lib/sandbox';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { Textarea } from '../ui/textarea';

/** A reply in the open conversation, written as the user or as the other person. */
export function SandboxReplyForm({ threadId, party }: { threadId: string; party: string }) {
  const reply = useReplySandboxMail(threadId);
  const form = useForm<ReplySandboxMailRequest>({
    resolver: zodResolver(ReplySandboxMailRequestSchema),
    defaultValues: { as: 'me', body: '' },
  });
  const onSubmit = form.handleSubmit((input) =>
    reply.mutate(input, { onSuccess: () => form.reset({ as: input.as, body: '' }) }),
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Reply"
      className="space-y-3 border border-border-strong p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="reply-as">Reply as</Label>
        <NativeSelect id="reply-as" className="max-w-md flex-1" {...form.register('as')}>
          <option value="me">Me</option>
          <option value="them">{parseSender(party).name} (the other person)</option>
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reply-body">Your reply</Label>
        <Textarea id="reply-body" rows={4} {...form.register('body')} />
        {form.formState.errors.body && <p className="text-sm text-status-error">{BODY_PROBLEM}</p>}
      </div>
      {reply.isError && (
        <p role="alert" className="text-sm text-status-error">
          {sandboxProblem(reply.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          The earlier mail is quoted below your text. The app sees the reply after the next sync.
        </p>
        <Button type="submit" disabled={reply.isPending}>
          {reply.isPending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </form>
  );
}
