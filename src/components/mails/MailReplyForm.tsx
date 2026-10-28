import {
  Suspense,
  lazy,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useSendMailReply } from '../../api/mailbox';
import type { DraftDoc } from '../../contracts/conversation';
import { keepReply, readKeptReply, useKeptReply } from '../../lib/keptReply';
import {
  replyChoice,
  replyProblem,
  replySentNote,
  replyTextProblem,
  type ReplyProblem,
} from '../../lib/mailReply';
import { parseSender } from '../../lib/mails';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Select } from '../ui/select';
import { showToast } from '../ui/toast';
import { PhoneReplySlots } from './phoneReplySlots';
import { ReplyAiHelp, WritingDraft, type ReplyAi } from './ReplyAiHelp';
import type { ReplyEditorHandle } from './RichReplyField';
import { useAiDraft } from './useAiDraft';

// The editor is the largest part of the page's code: it loads when the reply box opens.
const RichReplyField = lazy(() => import('./RichReplyField'));

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
        <div className="px-4 pt-3">
          <ReplyAiHelp
            ai={ai}
            writing={draft.writing}
            onWriting={draft.setWriting}
            onDraft={draft.onDraft}
          />
        </div>
      )}
      {draft.writing && (
        <div className="px-4 py-3">
          <WritingDraft model={ai?.model ?? null} onStop={draft.stop} />
        </div>
      )}
      <div hidden={draft.writing}>{children}</div>
    </>
  );
}

/** The line under the reply text: what to know before sending it. */
function replyNote(unconfirmed: boolean, writtenBy: string | null, hint: string) {
  if (unconfirmed) return 'Your text is kept on this device until you send or discard it.';
  return writtenBy
    ? `Written by ${writtenBy} from the whole conversation. Check it before you send.`
    : hint;
}

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

/** "Send reply", or "Send" in the phone's top bar; "Sending…" while it sends. */
function sendLabel(pending: boolean, short: boolean) {
  if (pending) return 'Sending…';
  return short ? 'Send' : 'Send reply';
}

/** After a send that could not be confirmed, sending again is a choice of its own. */
function ReplyButtons({
  unconfirmed,
  pending,
  onCheck,
  onSendAgain,
  form,
  short = false,
}: {
  unconfirmed: boolean;
  pending: boolean;
  onCheck: () => void;
  onSendAgain: () => void;
  /** The form's id, for a Send button outside it (the phone's top bar). */
  form?: string;
  /** "Send" instead of "Send reply": the phone's top bar. */
  short?: boolean;
}) {
  if (!unconfirmed)
    return (
      <Button
        type="submit"
        form={form}
        size={short ? 'sm' : 'default'}
        loading={pending}
        title="Send reply (⌘ Enter)"
      >
        {sendLabel(pending, short)}
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
  /** The reply on its way while it sends, then null: the conversation shows it at once. */
  onSending?: (doc: DraftDoc | null) => void;
  /** AI help for a job mail: reply choices and "Write with AI". */
  ai?: ReplyAi;
}

/** "Not sent yet. Kept on this device only." with Discard, when the box opened with kept text. */
function KeptLine({ onDiscard }: { onDiscard: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 px-4 pb-1 text-xs text-text-secondary">
      Not sent yet. Kept on this device only.
      <button
        type="button"
        onClick={onDiscard}
        className="cursor-pointer text-link hover:underline"
      >
        Discard
      </button>
    </p>
  );
}

/** While the editor loads: the same room, so nothing jumps. */
function EditorLoading() {
  return <div className="min-h-[164px] px-4 pt-3 text-sm text-text-tertiary">Write your reply</div>;
}

/**
 * The reply text in the rich text editor: kept on this device while unsent, filled by AI drafts,
 * and checked before it is sent.
 */
function useReplyText(threadId: string) {
  const editor = useRef<ReplyEditorHandle | null>(null);
  const [kept0] = useState(() => readKeptReply(threadId));
  // What the editor starts with: kept text, or a draft that came while the editor still loaded.
  const [start, setStart] = useState(kept0);
  const kept = useKeptReply(threadId);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (doc: DraftDoc | null) => {
    if (editor.current) editor.current.setDoc(doc);
    else setStart(doc);
  };
  const onReady = useCallback((handle: ReplyEditorHandle) => {
    editor.current = handle;
  }, []);
  const onChange = useCallback(
    (doc: DraftDoc) => {
      keepReply(threadId, doc);
      setProblem(null);
    },
    [threadId],
  );
  /** The reply to send, or null after saying what is wrong with it. */
  const take = (): DraftDoc | null => {
    const handle = editor.current;
    if (!handle) return null;
    const doc = handle.getDoc();
    const wrong = replyTextProblem(doc, handle.getText());
    setProblem(wrong);
    if (wrong) handle.focus();
    return wrong ? null : doc;
  };
  const discard = () => {
    const before = editor.current?.getDoc() ?? null;
    set(null);
    keepReply(threadId, null);
    showToast('Reply discarded', { undo: () => set(before) });
  };
  return {
    initial: start,
    showKept: !!kept0 && !!kept,
    problem,
    onReady,
    onChange,
    take,
    discard,
    get: () => editor.current?.getDoc() ?? null,
    set,
    clear: () => {
      set(null);
      keepReply(threadId, null);
    },
  };
}

/**
 * Sending the reply: once per reply ID, shown at once in the conversation while it goes. After a
 * send that could not be confirmed, nothing goes again unless the user chooses "Send again".
 */
function useReplySend({
  threadId,
  replyTo,
  replyCc,
  toAll,
  text,
  writing,
  onSending,
}: {
  threadId: string;
  replyTo: string;
  replyCc: string[];
  toAll: boolean;
  text: ReturnType<typeof useReplyText>;
  /** True while the AI writes: the box is locked. */
  writing: boolean;
  onSending?: (doc: DraftDoc | null) => void;
}) {
  const [replyId, setReplyId] = useState(() => crypto.randomUUID());
  const send = useSendMailReply(threadId);
  const problem = send.isError ? replyProblem(send.error) : null;
  const submit = (id: string) => {
    if (writing) return;
    const doc = text.take();
    if (!doc) return;
    onSending?.(doc);
    send.mutate(
      { replyId: id, doc, ...(toAll ? { toAll } : {}) },
      {
        onSuccess: () => {
          text.clear();
          setReplyId(crypto.randomUUID());
          showToast(replySentNote(replyTo, toAll ? replyCc : []));
        },
        onSettled: () => onSending?.(null),
      },
    );
  };
  return {
    pending: send.isPending,
    problem,
    unconfirmed: problem?.kind === 'unconfirmed',
    // Names who the sent reply went to, whatever the user chooses for the next one.
    sentNote: send.isSuccess ? replySentNote(replyTo, send.variables.toAll ? replyCc : []) : null,
    submit: () => submit(replyId),
    // The user's own decision after an unconfirmed send: a new reply with a new ID.
    sendAgain: () => {
      const next = crypto.randomUUID();
      setReplyId(next);
      submit(next);
    },
  };
}

/** The reply text in the editor, with what is wrong with it and the kept-text line under it. */
function ReplyText({
  text,
  phone,
  onSubmitKey,
  actions,
}: {
  text: ReturnType<typeof useReplyText>;
  phone: boolean;
  onSubmitKey: () => void;
  actions?: React.ReactNode;
}) {
  const problemId = useId();
  return (
    <Suspense fallback={<EditorLoading />}>
      <RichReplyField
        initial={text.initial}
        onChange={text.onChange}
        onSubmitKey={onSubmitKey}
        onReady={text.onReady}
        phone={phone}
        invalid={!!text.problem}
        describedBy={text.problem ? problemId : undefined}
        actions={actions}
      >
        {text.problem && (
          <p id={problemId} className="px-4 pb-1 text-sm text-danger-text">
            {text.problem}
          </p>
        )}
        {text.showKept && <KeptLine onDiscard={text.discard} />}
      </RichReplyField>
    </Suspense>
  );
}

/**
 * The reply box of a conversation, in the calm card of the rich text reply (owner, 25 Oct 2026).
 * On a phone, Send sits in the reply screen's top bar.
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
  const formId = useId();
  const phone = useIsPhone();
  const sendSlot = useContext(PhoneReplySlots)?.send ?? null;
  const [all, setAll] = useState(true);
  const toAll = all && replyCc.length > 0;
  const text = useReplyText(threadId);
  const draft = useAiDraft(text);
  const reply = useReplySend({
    threadId,
    replyTo,
    replyCc,
    toAll,
    text,
    writing: draft.writing,
    onSending,
  });
  const buttons = (inTopBar: boolean) => (
    <ReplyButtons
      unconfirmed={reply.unconfirmed}
      pending={reply.pending}
      onCheck={onCheck}
      onSendAgain={reply.sendAgain}
      form={inTopBar ? formId : undefined}
      short={inTopBar}
    />
  );
  const desktopActions = (
    <>
      {children}
      {buttons(false)}
    </>
  );
  return (
    <>
      <form
        id={formId}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          reply.submit();
        }}
        noValidate
        aria-label="Reply"
        className="flex animate-open flex-col border border-border-default bg-surface transition-colors duration-70 ease-standard focus-within:border-border-focus"
      >
        <div className="flex flex-col gap-3 px-4 pt-3 empty:hidden">
          <ReplyOutcome sentNote={reply.sentNote} problem={reply.problem} />
          <ReplyReceivers replyTo={replyTo} others={replyCc} toAll={toAll} onToAll={setAll} />
        </div>
        <ReplyWriting ai={ai} draft={draft}>
          <ReplyText
            text={text}
            phone={phone}
            onSubmitKey={reply.submit}
            actions={phone ? undefined : desktopActions}
          />
        </ReplyWriting>
      </form>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        {replyNote(reply.unconfirmed, draft.writtenBy, hint)}
        {phone && children}
      </p>
      {phone && sendSlot && createPortal(buttons(true), sendSlot)}
    </>
  );
}
