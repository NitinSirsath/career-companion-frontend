import type { SandboxMessage } from '../../contracts/sandbox';
import { mailDateTime, parseSender } from '../../lib/mails';
import { sandboxRecipients, splitQuote } from '../../lib/sandbox';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

/** One sandbox mail with its text. The user's own mails are marked and shaded. */
export function SandboxMessageCard({ message }: { message: SandboxMessage }) {
  const sender = parseSender(message.from);
  const { own, quoted } = splitQuote(message.text);
  return (
    <article
      className={cn(
        'border border-border-default',
        message.sentByUser ? 'bg-surface-subtle' : 'bg-surface',
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle p-4 text-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-semibold">{message.sentByUser ? 'Me' : sender.name}</span>
          {message.sentByUser && <Badge>Your reply</Badge>}
          {!message.sentByUser && sender.address && (
            <span className="break-all text-text-secondary">{sender.address}</span>
          )}
          <span className="text-text-secondary">{sandboxRecipients(message)}</span>
        </div>
        <span className="text-text-secondary">{mailDateTime(message.date)}</span>
      </header>
      <div className="space-y-3 p-4 text-sm">
        <p className="whitespace-pre-wrap break-words">{own}</p>
        {quoted && (
          <blockquote className="whitespace-pre-wrap break-words border-l-2 border-border-strong pl-3 text-text-secondary">
            {quoted}
          </blockquote>
        )}
      </div>
    </article>
  );
}
