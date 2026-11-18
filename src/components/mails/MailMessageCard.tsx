import { useState } from 'react';
import { format, isThisYear, isToday } from 'date-fns';
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, DownloadIcon } from 'lucide-react';
import { AiIcon } from '../ui/ai-icon';
import { attachmentUrl } from '../../api/mailbox';
import type { ConversationDetail, ConversationMail } from '../../contracts/conversation';
import type { MailMessage } from '../../contracts/mailbox';
import { mailPreview, mailText, readingAbove, readingSummary } from '../../lib/mailThread';
import {
  aiReading,
  attachmentInfo,
  mailDateTime,
  parseSender,
  recipientLine,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { AnalyzedBy } from '../ai/AnalyzedBy';
import { useIsPhone } from '../layout/useIsPhone';
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
            <DownloadIcon size={16} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Every field the AI read, and whose reading it is. */
function ReadingDetails({ mail, className }: { mail: ConversationMail; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {aiReading(mail).map((row) => (
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
  );
}

/**
 * The AI's reading on a phone's mail page (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #2): one
 * grey "✦ AI read: …" line under the next step, which opens to every field.
 */
export function PhoneAiRead({ detail }: { detail: ConversationDetail }) {
  const [open, setOpen] = useState(false);
  const mail = readingAbove(detail);
  if (!mail) return null;
  const summary = readingSummary(mail);
  return (
    <div className="-mx-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-9 w-full cursor-pointer items-start gap-[7px] pt-0.5 pr-[18px] pb-3.5 pl-[46px] text-left text-[13.5px] leading-[18px] text-text-secondary active:opacity-50"
      >
        <AiIcon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className={cn('min-w-0 flex-1', !open && 'truncate')}>
          AI read: {summary || 'nothing more than the type'}
        </span>
      </button>
      <Collapse open={open}>
        <ReadingDetails mail={mail} className="pr-[18px] pb-4 pl-[46px]" />
      </Collapse>
    </div>
  );
}

/** The AI's reading of this mail, under the mail: one quiet line that opens to every field. */
function AiReadingStrip({ mail }: { mail: ConversationMail }) {
  const [open, setOpen] = useState(false);
  const phone = useIsPhone();
  const summary = readingSummary(mail);
  return (
    <div className="border-t border-border-subtle max-md:border-dashed">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full cursor-pointer items-start gap-2 px-4 py-2.5 text-left text-sm text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover max-md:min-h-11"
      >
        <AiIcon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        {/* On phones it is one line until opened (owner, 12 Nov 2026). */}
        <span className={cn('min-w-0 flex-1', phone && !open && 'truncate')}>
          <span className="font-semibold text-text-primary">AI read:</span>{' '}
          {summary || 'nothing more than the type'}
        </span>
        {phone ? (
          <ChevronRightIcon
            size={16}
            aria-hidden="true"
            className={cn(
              'mt-0.5 shrink-0 transition-transform duration-150 ease-standard',
              open && 'rotate-90',
            )}
          />
        ) : (
          <ChevronDownIcon
            size={16}
            aria-hidden="true"
            className={cn(
              'mt-0.5 shrink-0 transition-transform duration-150 ease-standard',
              open && 'rotate-180',
            )}
          />
        )}
      </button>
      <Collapse open={open}>
        <ReadingDetails mail={mail} className="px-4 pb-4 pl-10" />
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
        className="inline-flex h-5 w-8 cursor-pointer items-center justify-center bg-surface-selected text-text-primary transition-colors duration-70 ease-standard hover:bg-border-default max-md:h-8 max-md:w-11 max-md:rounded-md"
      >
        <span aria-hidden="true" className="tracking-[2px]">
          ···
        </span>
      </button>
    </div>
  );
}

/** "Oct 31", or the time for today, beside the name in a phone's activity row. */
function phoneMailDate(iso: string | null): string {
  if (!iso) return 'Date unknown';
  const date = new Date(iso);
  return isToday(date)
    ? format(date, 'h:mm a')
    : format(date, isThisYear(date) ? 'MMM d' : 'MMM d, yyyy');
}

/** A folded mail: one line with who wrote it, its first words and when. */
function FoldedMail({ message, onOpen }: { message: MailMessage; onOpen: () => void }) {
  const mine = message.sentByUser;
  const name = mine ? 'You' : parseSender(message.from).name;
  const phone = useIsPhone();
  // Phones: one activity row (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #2): the picture,
  // "who · when", and the mail's first four lines.
  if (phone)
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open the mail from ${name}, ${mailDateTime(message.date)}`}
        className="grid w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 px-[18px] pt-1.5 pb-3.5 text-left transition-colors duration-450 active:bg-surface-selected active:duration-0"
      >
        <Avatar name={name} me={mine} className="size-7 text-[11px]" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] leading-7">
            <span className="font-semibold">{name}</span>
            <span className="text-text-tertiary"> · {phoneMailDate(message.date)}</span>
          </span>
          <span className="line-clamp-4 text-[14.5px] leading-5 break-words">
            {mailPreview(message) || '(No text)'}
        </span>
      </button>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the mail from ${name}, ${mailDateTime(message.date)}`}
      className="grid min-h-12 w-full cursor-pointer grid-cols-[32px_minmax(0,140px)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-2 text-left text-sm transition-colors duration-70 ease-standard hover:bg-layer-hover"
    >
      <Avatar name={name} me={mine} />
      <span className="truncate font-semibold">{name}</span>
      <span className="truncate text-text-secondary">{mailPreview(message)}</span>
      <span className="text-xs text-text-secondary">{mailDateTime(message.date)}</span>
    </button>
  );
}

/** Phones: the picture, "who · when", to whom, and the fold button, as an activity row. */
function PhoneMailHeader({
  name,
  mine,
  message,
  recipients,
  asks,
  onFold,
}: {
  name: string;
  mine: boolean;
  message: MailMessage;
  recipients: string | null;
  asks: boolean;
  onFold?: () => void;
}) {
  return (
    <header className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-x-2.5 px-[18px] pt-1.5 pb-1">
      <Avatar name={name} me={mine} className="size-7 text-[11px]" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] leading-7">
          <span className="font-semibold">{name}</span>
          <time dateTime={message.date ?? undefined} className="text-text-tertiary">
            {' '}
            · {mailDateTime(message.date)}
          </time>
        </span>
        {recipients && (
          <span className="text-xs break-words text-text-secondary">{recipients}</span>
        )}
        {asks && (
          <span className="pt-1">
            <Tag color="yellow">Asks you</Tag>
          </span>
        )}
      </span>
      {onFold && (
        <button
          type="button"
          aria-label="Fold this mail"
          onClick={onFold}
          className="-my-2 -mr-3 flex size-11 cursor-pointer items-center justify-center text-text-secondary"
        >
          <ChevronUpIcon size={16} aria-hidden="true" />
        </button>
      )}
    </header>
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
  if (useIsPhone())
    return (
      <PhoneMailHeader
        name={name}
        mine={mine}
        message={message}
        recipients={recipients}
        asks={asks}
        onFold={onFold}
      />
    );
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
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover max-md:-my-1.5 max-md:-mr-2 max-md:size-11"
        >
          <ChevronUpIcon size={16} aria-hidden="true" />
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
 * One mail of a conversation, on a card with a thin line; the user's own mails carry the blue
 * "You" picture. The quoted earlier mail is hidden. Folding and opening slide between the
 * one-line form and the whole mail.
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
  const phone = useIsPhone();
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
          className={cn(
            // Phones: no card, the mail runs edge to edge under a thin line (owner, 12 Nov 2026).
            phone ? 'pb-2' : 'rounded-lg border border-border-subtle bg-surface',
          )}
        >
          <MailHeader
            message={message}
            mailbox={mailbox}
            asks={asks}
            onFold={onFold && (() => onFold(true))}
          />
          <div
            className={cn(
              'flex flex-col gap-3',
              phone ? 'pr-[18px] pb-3 pl-[56px] text-[14.5px]' : 'px-4 pb-4 md:pl-[60px]',
            )}
          >
            <MailBody message={message} showQuote={quoteOpen} />
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
