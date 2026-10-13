import { attachmentUrl } from '../../api/mailbox';
import type { MailMessage } from '../../contracts/mailbox';
import { attachmentInfo, mailDateTime, parseSender, recipientLine } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { MailBody } from './MailBody';

/** Attached files as plain download links: a file from a sender is never opened in the app. */
function Attachments({ message }: { message: MailMessage }) {
  const count = message.attachments.length;
  return (
    <footer className="border-t border-border-subtle p-4 space-y-2">
      <p className="text-xs font-semibold text-text-secondary">
        {count} attachment{count === 1 ? '' : 's'}
      </p>
      <ul className="space-y-2">
        {message.attachments.map((attachment) => (
          <li
            key={attachment.partId}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm"
          >
            <span className="min-w-0 break-all">
              <span className="font-medium">{attachment.filename}</span>{' '}
              <span className="text-text-secondary">· {attachmentInfo(attachment)}</span>
            </span>
            <a
              href={attachmentUrl(message.id, attachment.partId)}
              download
              aria-label={`Download ${attachment.filename}`}
              className="font-medium text-action-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              Download
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}

/** One message of a thread. The user's own messages are marked and shaded. */
export function MailMessageCard({
  message,
  mailbox,
}: {
  message: MailMessage;
  /** The user's own mail address, so the other people on the mail can be named. */
  mailbox: string | null;
}) {
  const sender = parseSender(message.from);
  const recipients = recipientLine(message, mailbox);
  return (
    <article
      className={cn(
        'border border-border-default',
        message.sentByUser ? 'bg-surface-subtle' : 'bg-surface',
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{message.sentByUser ? 'You' : sender.name}</span>
            {message.sentByUser && <Badge>Your reply</Badge>}
            {!message.sentByUser && sender.address && (
              <span className="text-text-secondary break-all">{sender.address}</span>
            )}
          </div>
          {recipients && <p className="text-xs text-text-secondary break-words">{recipients}</p>}
        </div>
        <time
          dateTime={message.date ?? undefined}
          className="text-xs text-text-secondary whitespace-nowrap"
        >
          {mailDateTime(message.date)}
        </time>
        {message.labels.length > 0 && (
          <div className="basis-full flex flex-wrap gap-2">
            {message.labels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </header>
      <div className="p-4 space-y-3">
        <MailBody message={message} />
        {message.truncated && (
          <p className="text-xs text-text-secondary">
            This mail is very long and was cut here. Open it in Gmail to read all of it.
          </p>
        )}
      </div>
      {message.attachments.length > 0 && <Attachments message={message} />}
    </article>
  );
}
