import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, MachineLearningModel } from '@carbon/icons-react';
import { attachmentUrl } from '../../api/mailbox';
import type { ConversationMail } from '../../contracts/conversation';
import type { MailMessage } from '../../contracts/mailbox';
import { mailPreview, mailText, readingSummary } from '../../lib/mailThread';
import {
  aiReading,
  attachmentInfo,
  mailDateTime,
  parseSender,
  recipientLine,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { AnalyzedBy } from '../ai/AnalyzedBy';
import { Avatar } from '../ui/avatar';
import { Collapse } from '../ui/collapse';
import { Tag } from '../ui/tag';
import { MailBody } from './MailBody';

/** Attached files as chips that download: a file from a sender is never opened in the app. */
function Attachments({ message }: { message: MailMessage }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Attachments">
      {message.attachments.map((attachment) => (
        <li key={attachment.partId}>
          <a
            href={attachmentUrl(message.id, attachment.partId)}
            download
            aria-label={`Download ${attachment.filename}`}
            className="inline-flex h-8 items-center gap-2 bg-surface-selected px-3 text-sm text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover"
          >
            <span className="max-w-64 truncate">{attachment.filename}</span>
            <span className="text-xs text-text-secondary">{attachmentInfo(attachment)}</span>
            <Download size={16} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The AI's reading of this mail, under the mail: one quiet line that opens to every field. */
function AiReadingStrip({ mail }: { mail: ConversationMail }) {
  const [open, setOpen] = useState(false);
  const summary = readingSummary(mail);
  const rows = aiReading(mail);
  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full cursor-pointer items-start gap-2 px-4 py-2.5 text-left text-sm text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover"
      >
        <MachineLearningModel size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-text-primary">AI read:</span>{' '}
          {summary || 'nothing more than the type'}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            'mt-0.5 shrink-0 transition-transform duration-150 ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>
      <Collapse open={open}>
        <div className="flex flex-col gap-3 px-4 pb-4 pl-10">
          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-text-secondary">{row.label}</dt>
                <dd className="break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-text-secondary">
            This is the AI's reading, not the mail's own words.
          </p>
          <AnalyzedBy provider={mail.analyzedBy?.provider} model={mail.analyzedBy?.model} details />
        </div>
      </Collapse>
    </div>
  );
}

/** "···": shows or hides the quoted earlier mail, as Gmail does. */
function QuoteToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const label = open ? 'Hide the earlier mail' : 'Show the earlier mail';
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        title={label}
        aria-label={label}
        className="inline-flex h-5 w-8 cursor-pointer items-center justify-center bg-surface-selected text-text-primary transition-colors duration-70 ease-standard hover:bg-border-default"
      >
        <span aria-hidden="true" className="tracking-[2px]">
          ···
        </span>
      </button>
    </div>
  );
}

/** A folded mail: one line with who wrote it, its first words and when. */
function FoldedMail({ message, onOpen }: { message: MailMessage; onOpen: () => void }) {
  const mine = message.sentByUser;
  const name = mine ? 'You' : parseSender(message.from).name;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the mail from ${name}, ${mailDateTime(message.date)}`}
      className={cn(
        'grid min-h-12 w-full cursor-pointer grid-cols-[32px_minmax(0,140px)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-left text-sm transition-colors duration-70 ease-standard hover:bg-layer-hover',
        mine ? 'bg-tint md:ml-12 md:w-[calc(100%-3rem)]' : 'border border-border-subtle bg-surface',
      )}
    >
      <Avatar name={name} me={mine} />
      <span className="truncate font-semibold">{name}</span>
      <span className="truncate text-text-secondary">{mailPreview(message)}</span>
      <span className="text-xs text-text-secondary">{mailDateTime(message.date)}</span>
    </button>
  );
}

/** Who wrote the mail, to whom and when; the "Asks you" mark and the fold button. */
function MailHeader({
  message,
  mailbox,
  asks,
  onFold,
}: {
  message: MailMessage;
  mailbox: string | null;
  asks: boolean;
  onFold?: () => void;
}) {
  const mine = message.sentByUser;
  const sender = parseSender(message.from);
  const name = mine ? 'You' : sender.name;
  const recipients = recipientLine(message, mailbox);
  return (
    <header className="flex items-start gap-3 px-4 pt-4 pb-2">
      <Avatar name={name} me={mine} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="font-semibold" title={mine ? undefined : (sender.address ?? undefined)}>
            {name}
          </span>
          {recipients && (
            <span className="text-xs break-words text-text-secondary">{recipients}</span>
          )}
        </span>
        <time
          dateTime={message.date ?? undefined}
          title={message.date ? new Date(message.date).toString() : undefined}
          className="text-xs text-text-secondary"
        >
          {mailDateTime(message.date)}
        </time>
      </div>
      {asks && <Tag color="yellow">Asks you</Tag>}
      {onFold && (
        <button
          type="button"
          aria-label="Fold this mail"
          onClick={onFold}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover"
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
      )}
    </header>
  );
}

interface MailMessageCardProps {
  message: MailMessage;
  /** The user's own mail address, so the other people on the mail can be named. */
  mailbox: string | null;
  /** What the AI read from this mail, when it read it. */
  reading?: ConversationMail | null;
  /** This mail asked for the to-do that is open now. */
  asks?: boolean;
  folded: boolean;
  onFold?: (folded: boolean) => void;
}

/**
 * One mail of a conversation. Their mails sit on the plain card; the user's are tinted and set in
 * from the left, so who said what reads at a glance. The quoted earlier mail is hidden. Folding
 * and opening slide between the one-line form and the whole mail.
 */
export function MailMessageCard({
  message,
  mailbox,
  reading,
  asks = false,
  folded,
  onFold,
}: MailMessageCardProps) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const mine = message.sentByUser;
  const name = mine ? 'You' : parseSender(message.from).name;

  return (
    <div>
      <Collapse open={folded}>
        <FoldedMail message={message} onOpen={() => onFold?.(false)} />
      </Collapse>
      <Collapse open={!folded}>
        <article
          id={`mail-${message.id}`}
          aria-label={`Mail from ${name}, ${mailDateTime(message.date)}`}
          className={mine ? 'bg-tint md:ml-12' : 'border border-border-subtle bg-surface'}
        >
          <MailHeader
            message={message}
            mailbox={mailbox}
            asks={asks}
            onFold={onFold && (() => onFold(true))}
          />
          <div className="flex flex-col gap-3 px-4 pb-4 md:pl-[60px]">
            <MailBody message={message} showQuote={quoteOpen} mine={mine} />
            {message.truncated && (
              <p className="text-xs text-text-secondary">
                This mail is very long and was cut here. Open it in Gmail to read all of it.
              </p>
            )}
            {mailText(message).hasQuote && (
              <QuoteToggle open={quoteOpen} onToggle={() => setQuoteOpen(!quoteOpen)} />
            )}
            {message.attachments.length > 0 && <Attachments message={message} />}
          </div>
          {reading && <AiReadingStrip mail={reading} />}
        </article>
      </Collapse>
    </div>
  );
}
