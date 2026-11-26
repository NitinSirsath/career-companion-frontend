import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { ReplyIcon } from 'lucide-react';
import { useSandboxMailbox } from '../../api/appMode';
import { useCanSendMail } from '../../api/mailbox';
import type { DraftDoc } from '../../contracts/conversation';
import { useKeptReply } from '../../lib/keptReply';
import { allowSendingUrl, NO_REPLY_NOTE, replyHint } from '../../lib/mailReply';
import { parseSender } from '../../lib/mails';
import { docWords } from '../../lib/replyDoc';
import { useIsPhone } from '../layout/useIsPhone';
import { AiIcon } from '../ui/ai-icon';
import { Button } from '../ui/button';
import { GmailLink } from '../ui/GmailLink';
import { MailReplyForm } from './MailReplyForm';
import { Sheet, SheetCenterHeader } from '../ui/sheet';
import { PhoneReplySlots } from './phoneReplySlots';
import type { ReplyAi } from './ReplyAiHelp';

const NOBODY_WROTE =
  'Nobody else wrote in this conversation, so there is no mail to reply to here.';

/** A reply box that cannot send yet: says why, and offers the way out. */
function ReplyNotice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="Reply"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-border-subtle bg-surface p-4"
    >
      <div className="min-w-0 flex-1 basis-64 space-y-1">
        <p className="text-sm font-semibold">Reply</p>
        <p className="text-sm text-text-secondary">{text}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

/** "R" opens the reply box, unless the user is typing somewhere. */
function useReplyKey(onReply: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (
        event.key.toLowerCase() === 'r' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !typing
      ) {
        event.preventDefault();
        onReply();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onReply]);
}

/**
 * Whether the reply box is open. "R" opens it, and so does each click on the page's Reply button,
 * counted in `replyAsks`.
 */
function useReplyOpen(replyAsks: number, startOpen: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(startOpen);
  useReplyKey(() => setOpen(true));
  const [askedFor, setAskedFor] = useState(replyAsks);
  if (askedFor !== replyAsks) {
    setAskedFor(replyAsks);
    setOpen(true);
  }
  // The open box is tall: bring the page to its end, so the newest mail shows above the box.
  useEffect(() => {
    const page = document.scrollingElement;
    if (open) page?.scrollTo?.({ top: page.scrollHeight, behavior: 'smooth' });
  }, [open]);
  return [open, setOpen];
}

/**
 * On phones the open reply is a tall sheet (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`):
 * Close at its top left, Send at its top right, the AI help and the text, and at its bottom, above
 * the keyboard, the one-line note and the text tools (owner, 15 Nov 2026, `REPLY-SHEET-mock/`).
 * The bottom keeps the home bar's room while the keyboard is closed, and none while it is open.
 * Closing it only hides it: the text stays (also on this device), and Reply shows it again.
 */
function PhoneReplyScreen({ replyAsks, children }: { replyAsks: number; children: ReactNode }) {
  const [shown, setShown] = useState(true);
  const [askedFor, setAskedFor] = useState(replyAsks);
  const [send, setSend] = useState<HTMLElement | null>(null);
  const [note, setNote] = useState<HTMLElement | null>(null);
  const [ai, setAi] = useState<HTMLElement | null>(null);
  const [format, setFormat] = useState<HTMLElement | null>(null);
  if (askedFor !== replyAsks) {
    setAskedFor(replyAsks);
    setShown(true);
  }
  return (
    <Sheet
      tall
      initialFocus={false}
      open={shown}
      onOpenChange={setShown}
      title="Reply"
      header={
        <SheetCenterHeader title="Reply" closeLabel="Close reply" end={<div ref={setSend} />} />
      }
      contentClassName="px-4 pb-3"
      footer={
        <div className="shrink-0 pb-[max(8px,env(safe-area-inset-bottom)-var(--drawer-keyboard-inset,0px))]">
          <div ref={setNote} />
          {/* One glass tool bar on top of the keyboard: ✦ AI, then the text tools. */}
          <div
            role="group"
            aria-label="Reply tools"
            className="glass mx-2.5 mt-2 flex h-11 items-center gap-1 rounded-full px-1.5"
          >
            <div ref={setAi} className="contents" />
            <div ref={setFormat} className="ml-auto flex min-w-0 items-center" />
          </div>
        </div>
      }
    >
      <div className="flex flex-1 flex-col [&>form]:rounded-none [&>form]:border-0 [&>form]:bg-transparent">
        <PhoneReplySlots.Provider value={{ send, note, ai, format }}>
          {children}
        </PhoneReplySlots.Provider>
      </div>
    </Sheet>
  );
}

/**
 * The reply box while closed (laptop v2, owner 18 Nov 2026): one round bar, "Draft" with its first
 * words when text is kept, and "AI" beside it on a job mail, which opens the reply with the AI's
 * choices and the hint ready. "R" opens it too.
 */
function ClosedReplyBar({
  replyTo,
  kept,
  onOpen,
  onAi,
  focusOnShow = false,
}: {
  replyTo: string;
  kept: DraftDoc | null;
  onOpen: () => void;
  /** A job mail: opens the reply with AI help. */
  onAi?: () => void;
  /** After the user closed the box, the focus comes back here. */
  focusOnShow?: boolean;
}) {
  const name = parseSender(replyTo).name;
  const bar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnShow) bar.current?.focus();
  }, [focusOnShow]);
  return (
    <div className="flex h-10 w-full items-center gap-2 rounded-full border border-border-default bg-field pr-1.5 text-sm transition-colors duration-70 ease-standard has-[>button:first-child:hover]:bg-layer-hover">
      <button
        ref={bar}
        type="button"
        onClick={onOpen}
        title="Reply (R)"
        className="flex h-full min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-full pl-3.5 text-left text-text-tertiary outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
      >
        <ReplyIcon size={16} aria-hidden="true" className="shrink-0" />
        {kept ? (
          // Unsent text kept on this device: the bar says so, with its first words.
          <span className="min-w-0 flex-1 truncate text-text-secondary">
            <span className="font-semibold text-text-primary">Draft</span> to {name}:{' '}
            {docWords(kept)}
          </span>
        ) : (
          <span className="flex-1 truncate">Reply to {name}…</span>
        )}
      </button>
      {onAi && (
        <button
          type="button"
          onClick={onAi}
          aria-label="Reply with AI"
          className="inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-layer-hover px-2.5 font-medium text-text-primary transition-colors duration-70 ease-standard hover:bg-surface-selected"
        >
          <AiIcon size={16} aria-hidden="true" className="text-text-secondary" />
          AI
        </button>
      )}
    </div>
  );
}

/**
 * Whether the reply box is open, and on laptops the "AI" button of the closed bar: it opens the
 * reply with the AI's choices and the hint ready. `replyAi` is the AI help to pass on, with that
 * start; `openWithAi` is undefined without AI help.
 */
function useReplyOpenWithAi(replyAsks: number, startOpen: boolean, ai: ReplyAi | undefined) {
  const [open, setOpen] = useReplyOpen(replyAsks, startOpen);
  const [start, setStart] = useState<{ choice: string | null } | null>(null);
  const replyAi = ai && start ? { ...ai, start, onStarted: () => setStart(null) } : ai;
  const openWithAi = () => {
    setStart({ choice: null });
    setOpen(true);
  };
  return { open, setOpen, replyAi, openWithAi: ai ? openWithAi : undefined };
}

/** The mailbox itself: Gmail in prod, the mail sandbox in dev mode. Small in the phone's note line. */
function Elsewhere({
  sandbox,
  threadId,
  subject,
}: {
  sandbox: boolean;
  threadId: string;
  subject: string | null;
}) {
  const phone = useIsPhone();
  if (sandbox)
    return (
      <Link
        to="/sandbox/$threadId"
        params={{ threadId }}
        className={phone ? 'text-xs text-link' : 'text-sm text-link'}
      >
        Open in the mail sandbox
      </Link>
    );
  return <GmailLink threadId={threadId} subject={subject} reply />;
}

/** Laptops: × and Esc close the box; the focus goes back to the closed bar. */
function useCloseByUser(setOpen: (open: boolean) => void) {
  const [closedByUser, setClosedByUser] = useState(false);
  const close = () => {
    setOpen(false);
    setClosedByUser(true);
  };
  return { closedByUser, close };
}

/**
 * Replying from the mail details page, docked under the conversation like a chat box: one line
 * until the user starts a reply. The same box in both modes: it sends from the user's Gmail in
 * prod and into the mail sandbox in dev mode. Who the reply goes to comes from the conversation:
 * no address can be typed here.
 */
export function MailReplyBox({
  threadId,
  subject,
  replyTo,
  replyCc,
  canReply,
  barSaysNoReply,
  onCheck,
  onSending,
  replyAsks = 0,
  ai,
  startOpen = false,
}: {
  threadId: string;
  subject: string | null;
  replyTo: string | null;
  /** The other people on the answered mail. */
  replyCc: string[];
  /** False when a reply to `replyTo` would reach nobody: no reply box then. An older server does not say. */
  canReply?: boolean;
  /** A job mail on a phone: its bottom bar says so, so no second note under the mails. */
  barSaysNoReply?: boolean;
  onCheck: () => void;
  onSending?: (doc: DraftDoc | null) => void;
  /** Goes up each time the page's Reply button is clicked: the box opens. */
  replyAsks?: number;
  /** AI help in the box, for a job mail. */
  ai?: ReplyAi;
  /** Open from the start, as when a phone's application page asked to reply. */
  startOpen?: boolean;
}) {
  const kept = useKeptReply(threadId);
  const sandbox = useSandboxMailbox();
  const canSend = useCanSendMail();
  const mailPath = useLocation({ select: (location) => location.pathname });
  const { open, setOpen, replyAi, openWithAi } = useReplyOpenWithAi(replyAsks, startOpen, ai);
  const { closedByUser, close } = useCloseByUser(setOpen);
  const phone = useIsPhone();
  const elsewhere = <Elsewhere sandbox={!!sandbox} threadId={threadId} subject={subject} />;

  let box: React.ReactNode;
  if (!replyTo) box = <ReplyNotice text={NOBODY_WROTE}>{elsewhere}</ReplyNotice>;
  // Nobody reads mail sent to this address.
  else if (canReply === false)
    box = barSaysNoReply ? null : <ReplyNotice text={NO_REPLY_NOTE}>{elsewhere}</ReplyNotice>;
  else if (canSend === false)
    box = (
      <ReplyNotice text="NorthList may read your Gmail, but not send from it yet. Allow sending to reply from here. Google asks you once.">
        {elsewhere}
        <Button type="button" onClick={() => window.location.assign(allowSendingUrl(mailPath))}>
          Allow sending
        </Button>
      </ReplyNotice>
    );
  // On phones the floating Reply button opens it: no closed bar under the conversation.
  else if (!open && phone) box = null;
  else if (!open)
    box = (
      <ClosedReplyBar
        replyTo={replyTo}
        kept={kept}
        onOpen={() => setOpen(true)}
        onAi={openWithAi}
        focusOnShow={closedByUser}
      />
    );
  else {
    box = (
      <MailReplyForm
        threadId={threadId}
        replyTo={replyTo}
        replyCc={replyCc}
        hint={replyHint(!!sandbox, phone)}
        subject={subject}
        onCheck={onCheck}
        onSending={onSending}
        ai={replyAi}
        onClose={phone ? undefined : close}
      >
        {elsewhere}
      </MailReplyForm>
    );
    if (phone) box = <PhoneReplyScreen replyAsks={replyAsks}>{box}</PhoneReplyScreen>;
  }
  // On phones nothing sticks to the bottom: the room there is the action bar's.
  if (phone) return box ? <div className="px-4 pt-3">{box}</div> : null;
  return <div className="sticky bottom-0 z-10 bg-background py-2">{box}</div>;
}
