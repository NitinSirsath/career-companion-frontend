import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useState } from 'react';
import { useForm, type FieldError, type UseFormRegisterReturn } from 'react-hook-form';
import type { z } from 'zod';
import { useSendMailReply } from '../../api/mailbox';
import {
  REPLY_TEXT_PROBLEM,
  REPLY_TOO_LONG,
  ReplyTextSchema,
  replyChoice,
  replyProblem,
  replySentNote,
  type ReplyProblem,
} from '../../lib/mailReply';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Select } from '../ui/select';
import { showToast } from '../ui/toast';
import { parseSender } from '../../lib/mails';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ReplyAiHelp, WritingDraft, type ReplyAi } from './ReplyAiHelp';
import { useAiDraft } from './useAiDraft';

/**
 * The reply text with AI help above it, for a job mail. While the AI writes, the text is hidden
 * behind "Writing…", and kept.
 */
function ReplyWriting({
  ai,
  draft,
  children,
}: {
  ai: ReplyAi | undefined;
  draft: ReturnType<typeof useAiDraft>;
  children: React.ReactNode;
}) {
  return (
    <>
      {ai && (
        <ReplyAiHelp
          ai={ai}
          writing={draft.writing}
          onWriting={draft.setWriting}
          onDraft={draft.onDraft}
        />
      )}
      {draft.writing && <WritingDraft model={ai?.model ?? null} onStop={draft.stop} />}
      <div hidden={draft.writing}>{children}</div>
    </>
  );
}

/** Under the reply text: what to know before sending it, beside the buttons. */
function ReplyFooter({ note, children }: { note: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <p className="min-w-0 flex-1 basis-64 text-xs text-text-secondary">{note}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** The line under the reply text: what to know before sending it. */
function replyNote(unconfirmed: boolean, writtenBy: string | null, hint: string) {
  if (unconfirmed) return 'Your text is kept here until you leave the page.';
  return writtenBy
    ? `Written by ${writtenBy} from the whole conversation. Check it before you send.`
    : hint;
}

type ReplyText = z.infer<typeof ReplyTextSchema>;

/** What became of the last send: sent, not confirmed, or not sent. */
function ReplyOutcome({
  sentNote,
  problem,
}: {
  sentNote: string | null;
  problem: ReplyProblem | null;
}) {
  if (sentNote) return <InlineNotification kind="success">{sentNote}</InlineNotification>;
  if (problem?.kind === 'unconfirmed')
    return (
      <InlineNotification kind="error" title="Could not confirm that your reply was sent.">
        Gmail did not answer in time. The reply may have gone out. Check the conversation before you
        send it again, so the same mail does not go out twice.
      </InlineNotification>
    );
  if (problem?.kind === 'not-sent')
    return <InlineNotification kind="error">{problem.message}</InlineNotification>;
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
      <Button type="submit" loading={pending} title="Send reply (⌘ Enter)">
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
 * Who the reply reaches. With other people on the mail it goes to all of them, unless the user
 * chooses the sender alone. These are the only two choices: no address is typed or removed.
 */
function ReplyReceivers({
  replyTo,
  others,
  toAll,
  onToAll,
}: {
  replyTo: string;
  others: string[];
  toAll: boolean;
  onToAll: (toAll: boolean) => void;
}) {
  const line = (label: string, people: string[]) => (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="w-6 text-xs text-text-secondary">{label}</span>
      {people.map((person) => (
        <span key={person} className="bg-tag-gray-bg px-2 text-xs leading-6 text-tag-gray">
          {parseSender(person).name}
        </span>
      ))}
    </span>
  );
  const chips = (
    <span className="flex min-w-0 flex-col gap-1">
      {line('To', [replyTo])}
      {toAll && line('Cc', others)}
    </span>
  );
  if (!others.length) return chips;
  const choice = replyChoice(replyTo, others, toAll);
  const all = replyChoice(replyTo, others, true);
  const one = replyChoice(replyTo, others, false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {chips}
        <Select<'all' | 'one'>
          label="Who gets this reply"
          hideLabel
          className="w-64"
          value={toAll ? 'all' : 'one'}
          options={[
            { value: 'all', label: all.title },
            { value: 'one', label: one.title },
          ]}
          onValueChange={(next) => onToAll(next === 'all')}
        />
      </div>
      {choice.leftOut && <p className="text-xs text-text-secondary">{choice.leftOut}</p>}
    </div>
  );
}

/** The text of the reply, and what is wrong with it. */
function ReplyTextField({
  input,
  error,
  onSubmitKey,
}: {
  input: UseFormRegisterReturn<'text'>;
  error: FieldError | undefined;
  /** Cmd+Enter or Ctrl+Enter sends. */
  onSubmitKey: () => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="sr-only">
        Your reply
      </Label>
      <Textarea
        id={id}
        rows={5}
        placeholder="Write your reply"
        className="min-h-32 resize-y"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmitKey();
          }
        }}
        {...input}
      />
      {error && (
        <p className="text-sm text-danger-text">
          {error.type === 'too_big' ? REPLY_TOO_LONG : REPLY_TEXT_PROBLEM}
        </p>
      )}
    </div>
  );
}

interface MailReplyFormProps {
  threadId: string;
  replyTo: string;
  /** The other people on the answered mail: a reply goes to them too unless the user says not. */
  replyCc: string[];
  hint: string;
  /** Reads the conversation again, so the user sees whether an unconfirmed reply is there. */
  onCheck: () => void;
  /** Another way to answer, shown beside the button. */
  children?: React.ReactNode;
  /** The text on its way while it sends, then null: the conversation shows it at once. */
  onSending?: (text: string | null) => void;
  /** AI help for a job mail: reply choices and "Write with AI". */
  ai?: ReplyAi;
}

/**
 * The reply box of a conversation. A reply is sent once: each one carries its own ID, and after
 * an answer that could not be confirmed nothing is sent again unless the user chooses "Send again".
 */
export function MailReplyForm({
  threadId,
  replyTo,
  replyCc,
  hint,
  onCheck,
  children,
  onSending,
  ai,
}: MailReplyFormProps) {
  const [replyId, setReplyId] = useState(() => crypto.randomUUID());
  const [all, setAll] = useState(true);
  const toAll = all && replyCc.length > 0;
  const send = useSendMailReply(threadId);
  const form = useForm<ReplyText>({
    resolver: zodResolver(ReplyTextSchema),
    defaultValues: { text: '' },
  });
  // The form shows when the user opens the reply box, by click or "R": they want to type now.
  const { setFocus } = form;
  useEffect(() => setFocus('text'), [setFocus]);
  const draft = useAiDraft(form);
  const problem = send.isError ? replyProblem(send.error) : null;
  const unconfirmed = problem?.kind === 'unconfirmed';
  // Names who the sent reply went to, whatever the user chooses for the next one.
  const sentTo = send.isSuccess && send.variables.toAll ? replyCc : [];

  const submit = (id: string) =>
    form.handleSubmit(({ text }) => {
      if (draft.writing) return; // locked while the AI writes
      onSending?.(text);
      send.mutate(
        { replyId: id, text, ...(toAll ? { toAll } : {}) },
        {
          onSuccess: () => {
            form.reset({ text: '' });
            setReplyId(crypto.randomUUID());
            showToast(replySentNote(replyTo, toAll ? replyCc : []));
          },
          onSettled: () => onSending?.(null),
        },
      );
    });
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
      className="flex animate-open flex-col gap-3 border border-border-subtle bg-surface p-4"
    >
      <ReplyOutcome
        sentNote={send.isSuccess ? replySentNote(replyTo, sentTo) : null}
        problem={problem}
      />
      <ReplyReceivers replyTo={replyTo} others={replyCc} toAll={toAll} onToAll={setAll} />
      <ReplyWriting ai={ai} draft={draft}>
        <ReplyTextField
          input={form.register('text')}
          error={form.formState.errors.text}
          onSubmitKey={() => void submit(replyId)()}
        />
      </ReplyWriting>
      <ReplyFooter note={replyNote(unconfirmed, draft.writtenBy, hint)}>
        {children}
        <ReplyButtons
          unconfirmed={unconfirmed}
          pending={send.isPending}
          onCheck={onCheck}
          onSendAgain={sendAgain}
        />
      </ReplyFooter>
    </form>
  );
}
