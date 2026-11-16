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
import { createPortal, flushSync } from 'react-dom';
import { useSendMailReply } from '../../api/mailbox';
import type { DraftDoc } from '../../contracts/conversation';
import { keepReply, readKeptReply, useKeptReply } from '../../lib/keptReply';
import { replyProblem, replySentNote, replyTextProblem } from '../../lib/mailReply';
import { isEmptyDoc } from '../../lib/replyDoc';
import { cn } from '../../lib/utils';
import { useIsPhone } from '../layout/useIsPhone';
import { useKeyboardOpen } from '../layout/useKeyboardOpen';
import { showToast } from '../ui/toast';
import {
  CloseReply,
  EditorLoading,
  KeptLine,
  ReplyButtons,
  ReplyOutcome,
  ReplyReceivers,
} from './MailReplyParts';
import { PhoneReplySlots } from './phoneReplySlots';
import { ReplyAiHelp, WritingDraft, type ReplyAi } from './ReplyAiHelp';
import type { ReplyEditorHandle } from './RichReplyField';
import { useAiDraft } from './useAiDraft';

// The editor is the largest part of the page's code: it loads when the reply box opens.
const RichReplyField = lazy(() => import('./RichReplyField'));

/**
 * The reply text with AI help above it, for a job mail. While the AI writes, the text is hidden
 * behind "Writing…", and kept. On a phone everything sits at the sheet's one edge, the text fills
 * the room, and `compact` shrinks the AI help to one row while the user types the reply.
 */
function ReplyWriting({
  ai,
  draft,
  phone,
  typing,
  children,
}: {
  ai: ReplyAi | undefined;
  draft: ReturnType<typeof useAiDraft>;
  phone: boolean;
  typing: ReturnType<typeof useReplyTyping>;
  children: React.ReactNode;
}) {
  return (
    <>
      {ai && (
        <div className={phone ? 'pt-3' : 'px-4 pt-3'}>
          <ReplyAiHelp
            ai={ai}
            writing={draft.writing}
            onWriting={draft.setWriting}
            onDraft={draft.onDraft}
            compact={typing.compact}
            onOpen={typing.openAi}
          />
        </div>
      )}
      {draft.writing && (
        <div className={phone ? 'py-3' : 'px-4 py-3'}>
          <WritingDraft model={ai?.model ?? null} onStop={draft.stop} />
        </div>
      )}
      <div hidden={draft.writing} className={cn(phone && 'flex flex-1 flex-col')}>
        {children}
      </div>
    </>
  );
}

/** Esc closes the box, unless a menu inside it took the key first. */
function closeOnEscape(event: React.KeyboardEvent, onClose?: () => void) {
  if (onClose && event.key === 'Escape' && !event.defaultPrevented) onClose();
}

/** The line under the reply text: what to know before sending it. */
function replyNote(unconfirmed: boolean, writtenBy: string | null, hint: string) {
  if (unconfirmed) return 'Your text is kept on this device until you send or discard it.';
  return writtenBy
    ? `Written by ${writtenBy} from the whole conversation. Check it before you send.`
    : hint;
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
  /** Laptops: closes the box. The text stays kept on this device, as on phones. */
  onClose?: () => void;
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
  // Nothing written yet: the phone's Send stays grey (owner, 15 Nov 2026).
  const [empty, setEmpty] = useState(() => !kept0 || isEmptyDoc(kept0));
  const set = (doc: DraftDoc | null) => {
    if (editor.current) editor.current.setDoc(doc);
    else {
      setStart(doc);
      setEmpty(!doc || isEmptyDoc(doc));
    }
  };
  const onReady = useCallback((handle: ReplyEditorHandle) => {
    editor.current = handle;
  }, []);
  const onChange = useCallback(
    (doc: DraftDoc) => {
      keepReply(threadId, doc);
      setProblem(null);
      setEmpty(isEmptyDoc(doc));
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
    empty,
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
    onSubmit: (event: FormEvent) => {
      event.preventDefault();
      submit(replyId);
    },
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
  autofocus,
  onFocusChange,
}: {
  text: ReturnType<typeof useReplyText>;
  phone: boolean;
  onSubmitKey: () => void;
  actions?: React.ReactNode;
  autofocus: boolean;
  onFocusChange: (focused: boolean) => void;
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
        autofocus={autofocus}
        onFocusChange={onFocusChange}
      >
        {text.problem && (
          <p id={problemId} className={cn('pb-1 text-sm text-danger-text', !phone && 'px-4')}>
            {text.problem}
          </p>
        )}
        {text.showKept && <KeptLine onDiscard={text.discard} phone={phone} />}
      </RichReplyField>
    </Suspense>
  );
}

/** Phones: while the user types the reply (its text has the focus and the keyboard is up), the AI
 * help is one row, so the text has room. A tap on that row opens the box at once, so the hint can
 * take the focus. */
function useReplyTyping(phone: boolean) {
  const [textFocus, setTextFocus] = useState(false);
  const keyboard = useKeyboardOpen();
  return {
    compact: phone && textFocus && keyboard,
    onFocusChange: setTextFocus,
    openAi: () => flushSync(() => setTextFocus(false)),
  };
}

/**
 * The note under the reply. On a phone: Send in the sheet's top bar, and the note as one line in its
 * bottom bar, with the way to answer in Gmail (or the mail sandbox).
 */
function ReplyNote({
  phone,
  note,
  send,
  children,
}: {
  phone: boolean;
  note: string;
  send: React.ReactNode;
  children: React.ReactNode;
}) {
  const slots = useContext(PhoneReplySlots);
  if (!phone)
    return (
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        {note}
      </p>
    );
  const line = (
    <p className="px-4 pt-2 text-xs text-text-secondary">
      {note}
      <span aria-hidden="true"> · </span>
      {children}
    </p>
  );
  return (
    <>
      {slots?.note && createPortal(line, slots.note)}
      {slots?.send && createPortal(send, slots.send)}
    </>
  );
}

/** What became of the last send, and who the reply reaches: at the sheet's edge on a phone. */
function ReplyHead({
  phone,
  closable,
  children,
}: {
  phone: boolean;
  closable: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 empty:hidden',
        phone ? 'pt-1' : 'px-4 pt-3',
        closable && 'pr-12',
      )}
    >
      {children}
    </div>
  );
}

const FORM_CLASS =
  'relative flex animate-open flex-col overflow-hidden rounded-lg border border-border-default bg-surface transition-colors duration-70 ease-standard focus-within:border-border-focus';

/**
 * The reply box of a conversation, in the calm card of the rich text reply (owner, 25 Oct 2026).
 * On a phone, Send sits in the reply screen's top bar, grey until there is text, and the note is
 * one line above the text tools (owner, 15 Nov 2026, `REPLY-SHEET-mock/`).
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
  onClose,
}: MailReplyFormProps) {
  const formId = useId();
  const phone = useIsPhone();
  const typing = useReplyTyping(phone);
  // Opened by "AI reply": the AI's hint box gets the focus, not the text (owner, 13 Nov 2026).
  const [hintFirst] = useState(() => !!ai?.start && !ai.start.choice);
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
      empty={text.empty}
    />
  );
  const note = replyNote(reply.unconfirmed, draft.writtenBy, hint);
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
        onSubmit={reply.onSubmit}
        noValidate
        aria-label="Reply"
        onKeyDown={(event) => closeOnEscape(event, onClose)}
        className={cn(FORM_CLASS, phone && 'flex-1')}
      >
        {onClose && <CloseReply onClose={onClose} />}
        <ReplyHead phone={phone} closable={!!onClose}>
          <ReplyOutcome sentNote={reply.sentNote} problem={reply.problem} />
          <ReplyReceivers replyTo={replyTo} others={replyCc} toAll={toAll} onToAll={setAll} />
        </ReplyHead>
        <ReplyWriting ai={ai} draft={draft} phone={phone} typing={typing}>
          <ReplyText
            text={text}
            phone={phone}
            onSubmitKey={reply.submit}
            actions={phone ? undefined : desktopActions}
            autofocus={!hintFirst}
            onFocusChange={typing.onFocusChange}
          />
        </ReplyWriting>
      </form>
      <ReplyNote phone={phone} note={note} send={phone && buttons(true)}>
        {children}
      </ReplyNote>
    </>
  );
}
