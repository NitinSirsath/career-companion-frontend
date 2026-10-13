import { Link, useLocation } from '@tanstack/react-router';
import { useDevMode } from '../../api/appMode';
import { useCanSendMail } from '../../api/mailbox';
import { allowSendingUrl, replyHint } from '../../lib/mailReply';
import { Button } from '../ui/button';
import { GmailLink } from '../ui/GmailLink';
import { MailReplyForm } from './MailReplyForm';

/** A reply box that cannot send yet: says why, and offers the way out. */
function ReplyNotice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="Reply"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border border-border-strong p-4"
    >
      <div className="min-w-0 flex-1 basis-64 space-y-1">
        <p className="text-sm font-semibold">Reply</p>
        <p className="text-sm">{text}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

/**
 * Replying from the mail details page. The same box in both modes: it sends from the user's
 * Gmail in prod and into the mail sandbox in dev mode. Who the reply goes to comes from the
 * conversation and cannot be changed here.
 */
export function MailReplyBox({
  threadId,
  subject,
  replyTo,
  onCheck,
}: {
  threadId: string;
  subject: string | null;
  replyTo: string | null;
  onCheck: () => void;
}) {
  const devMode = useDevMode();
  const canSend = useCanSendMail();
  const mailPath = useLocation({ select: (location) => location.pathname });
  // The mailbox itself: Gmail in prod, the mail sandbox in dev mode.
  const elsewhere = devMode ? (
    <Link
      to="/sandbox/$threadId"
      params={{ threadId }}
      className="text-xs font-medium text-primary hover:underline"
    >
      Open in the mail sandbox
    </Link>
  ) : (
    <GmailLink threadId={threadId} subject={subject} reply />
  );

  if (!replyTo)
    return (
      <ReplyNotice text="Nobody else wrote in this conversation, so there is no mail to reply to here.">
        {elsewhere}
      </ReplyNotice>
    );
  if (canSend === false)
    return (
      <ReplyNotice text="Career Companion may read your Gmail, but not send from it yet. Allow sending to reply from here. Google asks you once.">
        {elsewhere}
        <Button type="button" onClick={() => window.location.assign(allowSendingUrl(mailPath))}>
          Allow sending
        </Button>
      </ReplyNotice>
    );
  return (
    <MailReplyForm
      threadId={threadId}
      replyTo={replyTo}
      hint={replyHint(devMode)}
      onCheck={onCheck}
    >
      {elsewhere}
    </MailReplyForm>
  );
}
