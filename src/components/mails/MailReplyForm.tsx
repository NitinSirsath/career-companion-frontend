import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useSendMailReply } from '../../api/mailbox';
import {
  REPLY_TEXT_PROBLEM,
  REPLY_TOO_LONG,
  ReplyTextSchema,
  replyProblem,
  replySentNote,
  type ReplyProblem,
} from '../../lib/mailReply';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

type ReplyText = z.infer<typeof ReplyTextSchema>;

/** What became of the last send: sent, not confirmed, or not sent. */
function ReplyOutcome({
  sentNote,
  problem,
}: {
  sentNote: string | null;
  problem: ReplyProblem | null;
}) {
  if (sentNote)
    return (
      <p role="status" className="border border-status-success p-3 text-sm">
        {sentNote}
      </p>
    );
  if (problem?.kind === 'unconfirmed')
    return (
      <div role="alert" className="space-y-1 border border-status-error p-3 text-sm">
        <p className="font-semibold text-status-error">
          Could not confirm that your reply was sent
        </p>
        <p>
          Gmail did not answer in time. The reply may have gone out. Check the conversation before
          you send it again, so the same mail does not go out twice.
        </p>
      </div>
    );
  if (problem?.kind === 'not-sent')
    return (
      <p role="alert" className="text-sm text-status-error">
        {problem.message}
      </p>
    );
  return null;
}

/** After a send that could not be confirmed, sending again is a choice of its own. */
function ReplyButtons({
  unconfirmed,
  pending,
  onCheck,
  onSendAgain,
}: {
  unconfirmed: boolean;
  pending: boolean;
  onCheck: () => void;
  onSendAgain: () => void;
}) {
  if (!unconfirmed)
    return (
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send reply'}
      </Button>
    );
  return (
    <>
      <Button type="button" variant="tertiary" onClick={onCheck}>
        Check the conversation
      </Button>
      <Button type="button" disabled={pending} onClick={onSendAgain}>
        {pending ? 'Sending…' : 'Send again'}
      </Button>
    </>
  );
}

/**
 * The reply box of a conversation. A reply is sent once: each one carries its own ID, and after
 * an answer that could not be confirmed nothing is sent again unless the user chooses "Send again".
 */
export function MailReplyForm({
  threadId,
  replyTo,
  hint,
  onCheck,
  children,
}: {
  threadId: string;
  replyTo: string;
  hint: string;
  /** Reads the conversation again, so the user sees whether an unconfirmed reply is there. */
  onCheck: () => void;
  /** Another way to answer, shown beside the button. */
  children?: React.ReactNode;
}) {
  const textId = useId();
  const [replyId, setReplyId] = useState(() => crypto.randomUUID());
  const send = useSendMailReply(threadId);
  const form = useForm<ReplyText>({
    resolver: zodResolver(ReplyTextSchema),
    defaultValues: { text: '' },
  });
  const problem = send.isError ? replyProblem(send.error) : null;
  const unconfirmed = problem?.kind === 'unconfirmed';
  const textError = form.formState.errors.text;

  const submit = (id: string) =>
    form.handleSubmit(({ text }) =>
      send.mutate(
        { replyId: id, text },
        {
          onSuccess: () => {
            form.reset({ text: '' });
            setReplyId(crypto.randomUUID());
          },
        },
      ),
    );
  // The user's own decision after an unconfirmed send: a new reply with a new ID.
  const sendAgain = () => {
    const next = crypto.randomUUID();
    setReplyId(next);
    void submit(next)();
  };

  return (
    <form
      onSubmit={submit(replyId)}
      noValidate
      aria-label="Reply"
      className="space-y-3 border border-border-strong p-4"
    >
      <ReplyOutcome sentNote={send.isSuccess ? replySentNote(replyTo) : null} problem={problem} />
      <p className="break-words text-sm">
        <span className="font-semibold">Reply</span>{' '}
        <span className="text-text-secondary">to {replyTo}</span>
      </p>
      <div className="space-y-2">
        <Label htmlFor={textId}>Your reply</Label>
        <Textarea id={textId} rows={5} {...form.register('text')} />
        {textError && (
          <p className="text-sm text-status-error">
            {textError.type === 'too_big' ? REPLY_TOO_LONG : REPLY_TEXT_PROBLEM}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="min-w-0 flex-1 basis-64 text-xs text-text-secondary">
          {unconfirmed ? 'Your text is kept here until you leave the page.' : hint}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {children}
          <ReplyButtons
            unconfirmed={unconfirmed}
            pending={send.isPending}
            onCheck={onCheck}
            onSendAgain={sendAgain}
          />
        </div>
      </div>
    </form>
  );
}
