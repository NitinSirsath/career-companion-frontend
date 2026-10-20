import { useEffect, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Reply } from '@carbon/icons-react';
import { useDevMode } from '../../api/appMode';
import { useCanSendMail } from '../../api/mailbox';
import { allowSendingUrl, replyHint } from '../../lib/mailReply';
import { parseSender } from '../../lib/mails';
import { Button } from '../ui/button';
import { GmailLink } from '../ui/GmailLink';
import { MailReplyForm } from './MailReplyForm';

/** A reply box that cannot send yet: says why, and offers the way out. */
function ReplyNotice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="Reply"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-surface p-4"
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
}: {
  threadId: string;
  subject: string | null;
  replyTo: string | null;
  /** The other people on the answered mail. */
  replyCc: string[];
  onCheck: () => void;
  onSending?: (text: string | null) => void;
}) {
  const devMode = useDevMode();
  const canSend = useCanSendMail();
  const mailPath = useLocation({ select: (location) => location.pathname });
  const [open, setOpen] = useState(false);
  useReplyKey(() => setOpen(true));
  // The open box is tall: bring the page to its end, so the newest mail shows above the box.
  useEffect(() => {
    const page = document.scrollingElement;
    if (open) page?.scrollTo?.({ top: page.scrollHeight, behavior: 'smooth' });
  }, [open]);
  // The mailbox itself: Gmail in prod, the mail sandbox in dev mode.
  const elsewhere = devMode ? (
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
      <ReplyNotice text="Career Companion may read your Gmail, but not send from it yet. Allow sending to reply from here. Google asks you once.">
        {elsewhere}
        <Button type="button" onClick={() => window.location.assign(allowSendingUrl(mailPath))}>
          Allow sending
        </Button>
      </ReplyNotice>
    );
  else if (!open)
    box = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full cursor-text items-center gap-3 border-b border-border-strong bg-surface px-4 text-left text-sm text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover"
      >
        <Reply size={16} aria-hidden="true" />
        <span className="flex-1">Reply to {parseSender(replyTo).name}…</span>
        <kbd className="border border-border-default px-1.5 font-mono text-xs">R</kbd>
      </button>
    );
  else
    box = (
      <MailReplyForm
        threadId={threadId}
        replyTo={replyTo}
        replyCc={replyCc}
        hint={replyHint(devMode)}
        onCheck={onCheck}
        onSending={onSending}
      >
        {elsewhere}
      </MailReplyForm>
    );
  return <div className="sticky bottom-16 z-10 bg-background py-2 md:bottom-0">{box}</div>;
}
