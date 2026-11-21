import { useState } from 'react';
import { ArrowUpIcon, ChevronRightIcon } from 'lucide-react';
import { useRemoveMessage, useSendMessage, useSentMessages } from '../../api/messages';
import type { AdminAccount } from '../../contracts/admin';
import { OWNER_MESSAGE_MAX_LENGTH, type AdminSentMessage } from '../../contracts/messages';
import { count } from '../../lib/admin';
import { devicesWord, EVERYONE, sentLine } from '../../lib/adminMessages';
import { cn } from '../../lib/utils';
import { PlainRow } from '../phone/PlainList';
import { InlineNotification } from '../ui/notification';
import { SectionError } from '../ui/section-error';
import { Sheet, SheetCenterHeader } from '../ui/sheet';
import { SkeletonList } from '../ui/skeleton';
import { Switch } from '../ui/switch';

const FORM_ID = 'owner-message-form';

/** "To" as a pill; tapping it opens the phone's own picker: everyone or one account. */
function ToPill({
  accounts,
  to,
  onChange,
}: {
  accounts: readonly AdminAccount[];
  to: string;
  onChange: (to: string) => void;
}) {
  const label =
    to === EVERYONE
      ? `Everyone · ${count(accounts.length)} accounts`
      : (accounts.find((account) => account.id === to)?.email ?? 'Everyone');
  return (
    <div className="-mx-[18px] flex items-center gap-2.5 border-b border-border-subtle px-[18px] py-[9px] text-[14.5px]">
      <span className="w-[26px] text-text-secondary">To</span>
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        <span className="inline-flex h-[27px] min-w-0 items-center truncate rounded-full bg-[var(--glass-pill)] px-2.5 text-[13.5px] font-medium">
          {label}
        </span>
        <ChevronRightIcon size={14} aria-hidden="true" className="ml-auto text-text-tertiary" />
        <select
          aria-label="To"
          value={to}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value={EVERYONE}>Everyone · {count(accounts.length)} accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

function SentRow({ message }: { message: AdminSentMessage }) {
  const remove = useRemoveMessage();
  const removed = message.removedAt !== null;
  return (
    <PlainRow
      detail={removed ? `${sentLine(message)} · Removed` : sentLine(message)}
      className={cn(removed && 'opacity-55')}
      end={
        !removed && (
          <button
            type="button"
            onClick={() => remove.mutate(message.id)}
            disabled={remove.isPending}
            className="cursor-pointer text-[14.5px] font-semibold text-late disabled:opacity-50"
          >
            {remove.isPending ? 'Removing…' : 'Remove'}
          </button>
        )
      }
    >
      <span className="line-clamp-2 break-words">{message.text}</span>
    </PlainRow>
  );
}

/** The last 10 sent, newest first, each with Remove. */
function SentList({ sent }: { sent: ReturnType<typeof useSentMessages> }) {
  if (sent.isLoading) return <SkeletonList rows={2} label="Loading sent messages" />;
  if (sent.error) return <SectionError title="Could not load sent messages" />;
  if (!sent.data?.messages.length) return null;
  return (
    <SheetRows label="Sent">
      {sent.data.messages.map((message) => (
        <SentRow key={message.id} message={message} />
      ))}
    </SheetRows>
  );
}

/** Plain rows inside the tall sheet, edge to edge, with an optional small grey label. */
function SheetRows({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="mb-[22px]">
      {label && <h2 className="px-[18px] pb-1.5 text-phone-label text-text-secondary">{label}</h2>}
      <div className="border-y border-border-subtle">{children}</div>
    </section>
  );
}

/** The send button in the sheet's title row: round, in the accent, an arrow up. */
function SendButton({ ready, sending }: { ready: boolean; sending: boolean }) {
  return (
    <button
      type="submit"
      form={FORM_ID}
      aria-label={sending ? 'Sending…' : 'Send'}
      disabled={!ready || sending}
      className="flex size-[38px] cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent transition-[opacity,scale] duration-200 active:scale-105 disabled:cursor-default disabled:opacity-40"
    >
      <ArrowUpIcon size={18} strokeWidth={2.3} aria-hidden="true" />
    </button>
  );
}

/** The alert switch, off by default, with how many devices would get it. */
function AlertRow({
  checked,
  onChange,
  devices,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  devices: number;
}) {
  return (
    <SheetRows>
      <PlainRow
        detail={devices ? `${devicesWord(devices)} with alerts on` : 'No devices with alerts on'}
        end={
          <Switch
            label="Also send as an alert"
            checked={checked}
            onCheckedChange={onChange}
            disabled={devices === 0}
          />
        }
      >
        Also send as an alert
      </PlainRow>
    </SheetRows>
  );
}

/** What the sheet holds while it is written: to whom, the text, and the alert. */
function useDraft(sent: ReturnType<typeof useSentMessages>) {
  const [to, setTo] = useState<string>(EVERYONE);
  const [text, setText] = useState('');
  const [alsoAlert, setAlsoAlert] = useState(false);
  const devices = sent.data?.alertDevices ?? {};
  const alertCount =
    to === EVERYONE ? Object.values(devices).reduce((sum, n) => sum + n, 0) : (devices[to] ?? 0);
  return { to, setTo, text, setText, alsoAlert, setAlsoAlert, alertCount };
}

/**
 * Write a message, on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 14): the same
 * tall sheet as Reply, with × , the title and a round blue Send. To is a pill (everyone or one
 * account), plain text up to 500, the alert switch off by default, and the sent list under it.
 */
export function MessageSheet({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: readonly AdminAccount[];
}) {
  const sent = useSentMessages();
  const send = useSendMessage();
  const draft = useDraft(sent);
  const ready = draft.text.trim().length > 0;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Message"
      tall
      initialFocus={false}
      contentClassName="px-0"
      header={
        <SheetCenterHeader
          title="Message"
          end={<SendButton ready={ready} sending={send.isPending} />}
        />
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col px-[18px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          send.mutate(
            { text: draft.text.trim(), to: draft.to, alsoAlert: draft.alsoAlert },
            {
              onSuccess: () => {
                draft.setText('');
                draft.setAlsoAlert(false);
              },
            },
          );
        }}
      >
        <ToPill accounts={accounts} to={draft.to} onChange={draft.setTo} />
        <textarea
          aria-label="Message"
          rows={4}
          maxLength={OWNER_MESSAGE_MAX_LENGTH}
          value={draft.text}
          onChange={(event) => draft.setText(event.target.value)}
          placeholder="Write a message…"
          className="mt-3 min-h-[104px] resize-none rounded-2xl bg-surface-subtle px-3.5 py-3 text-[15px] leading-[1.42] text-text-primary outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-border-focus"
        />
        <p className="pt-1.5 pr-0.5 text-right text-[12.5px] text-text-tertiary tabular-nums">
          {draft.text.length} / {OWNER_MESSAGE_MAX_LENGTH}
        </p>
        {send.error && (
          <InlineNotification kind="error" className="mt-2">
            The message was not sent. Try again.
          </InlineNotification>
        )}
      </form>
      <AlertRow
        checked={draft.alsoAlert}
        onChange={draft.setAlsoAlert}
        devices={draft.alertCount}
      />
      <SentList sent={sent} />
    </Sheet>
  );
}
