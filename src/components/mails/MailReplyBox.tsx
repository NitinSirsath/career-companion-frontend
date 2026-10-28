import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Close, Reply } from '@carbon/icons-react';
import { useSandboxMailbox } from '../../api/appMode';
import { useCanSendMail } from '../../api/mailbox';
import type { DraftDoc } from '../../contracts/conversation';
import { useKeptReply } from '../../lib/keptReply';
import { allowSendingUrl, replyHint } from '../../lib/mailReply';
import { parseSender } from '../../lib/mails';
import { docWords } from '../../lib/replyDoc';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { GmailLink } from '../ui/GmailLink';
import { MailReplyForm } from './MailReplyForm';
import { PhoneReplySlots } from './phoneReplySlots';
import type { ReplyAi } from './ReplyAiHelp';

/** A reply box that cannot send yet: says why, and offers the way out. */
function ReplyNotice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="Reply"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border border-border-subtle bg-surface p-4"
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
function useReplyOpen(replyAsks: number): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
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
 * The part of the screen the phone's keyboard leaves free, so the format row sits just above the
 * keyboard. Null where the browser does not tell (the whole screen is used).
 */
function useVisibleScreen(): { top: number; height: number } | null {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    const update = () => setArea({ top: view.offsetTop, height: view.height });
    update();
    view.addEventListener('resize', update);
    view.addEventListener('scroll', update);
    return () => {
      view.removeEventListener('resize', update);
      view.removeEventListener('scroll', update);
    };
  }, []);
  return area;
}

/**
 * On phones the open reply covers the screen, like a mail app's reply, with Send in its top bar.
 * Closing it only hides it: the text stays (also on this device), and Reply shows it again.
 */
function PhoneReplyScreen({ replyAsks, children }: { replyAsks: number; children: ReactNode }) {
  const [shown, setShown] = useState(true);
  const [askedFor, setAskedFor] = useState(replyAsks);
  const [send, setSend] = useState<HTMLElement | null>(null);
  const [format, setFormat] = useState<HTMLElement | null>(null);
  const area = useVisibleScreen();
  if (askedFor !== replyAsks) {
    setAskedFor(replyAsks);
    setShown(true);
  }
  return (
    <div
      hidden={!shown}
      style={area ? { top: area.top, height: area.height, bottom: 'auto' } : undefined}
      className="fixed inset-0 z-50 flex animate-open flex-col bg-background"
    >
      <div className="flex h-14 shrink-0 items-stretch border-b border-border-subtle">
        <button
          type="button"
          aria-label="Close reply"
          onClick={() => setShown(false)}
          className="flex w-14 shrink-0 cursor-pointer items-center justify-center border-r border-border-subtle hover:bg-layer-hover"
        >
          <Close size={20} aria-hidden="true" />
        </button>
        <p className="flex flex-1 items-center px-4 text-base font-semibold">Reply</p>
        <div ref={setSend} className="flex items-center px-3" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 [&>form]:border-0">
        <PhoneReplySlots.Provider value={{ send, format }}>{children}</PhoneReplySlots.Provider>
      </div>
      <div
        ref={setFormat}
        className="shrink-0 border-t border-border-subtle bg-background empty:hidden"
      />
    </div>
  );
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
  onCheck,
  onSending,
  replyAsks = 0,
  ai,
}: {
  threadId: string;
  subject: string | null;
  replyTo: string | null;
  /** The other people on the answered mail. */
  replyCc: string[];
  onCheck: () => void;
  onSending?: (doc: DraftDoc | null) => void;
  /** Goes up each time the page's Reply button is clicked: the box opens. */
  replyAsks?: number;
  /** AI help in the box, for a job mail. */
  ai?: ReplyAi;
}) {
  const kept = useKeptReply(threadId);
  const sandbox = useSandboxMailbox();
  const canSend = useCanSendMail();
  const mailPath = useLocation({ select: (location) => location.pathname });
  const [open, setOpen] = useReplyOpen(replyAsks);
  const phone = useIsPhone();
  // The mailbox itself: Gmail in prod, the mail sandbox in dev mode.
  const elsewhere = sandbox ? (
    <Link to="/sandbox/$threadId" params={{ threadId }} className="text-sm text-link">
      Open in the mail sandbox
    </Link>
  ) : (
    <GmailLink threadId={threadId} subject={subject} reply />
  );

  let box: React.ReactNode;
  if (!replyTo)
    box = (
      <ReplyNotice text="Nobody else wrote in this conversation, so there is no mail to reply to here.">
        {elsewhere}
      </ReplyNotice>
    );
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
    box = <ClosedReplyBar replyTo={replyTo} kept={kept} onOpen={() => setOpen(true)} />;
  else {
    box = (
      <MailReplyForm
        threadId={threadId}
        replyTo={replyTo}
        replyCc={replyCc}
        hint={replyHint(sandbox)}
        onCheck={onCheck}
        onSending={onSending}
        ai={ai}
      >
        {elsewhere}
      </MailReplyForm>
    );
    if (phone) box = <PhoneReplyScreen replyAsks={replyAsks}>{box}</PhoneReplyScreen>;
  }
  // On phones nothing sticks to the bottom: the room there is the floating Reply button's.
  if (phone) return <div className="pt-2 pb-16">{box}</div>;
  return <div className="sticky bottom-0 z-10 bg-background py-2">{box}</div>;
}
