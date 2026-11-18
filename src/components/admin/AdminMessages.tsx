import { useState } from 'react';
import { useRemoveMessage, useSendMessage, useSentMessages } from '../../api/messages';
import type { AdminAccount } from '../../contracts/admin';
import { OWNER_MESSAGE_MAX_LENGTH, type AdminSentMessage } from '../../contracts/messages';
import { count, whenLabel } from '../../lib/admin';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Select } from '../ui/select';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { Tag } from '../ui/tag';
import { Textarea } from '../ui/textarea';

const EVERYONE = 'EVERYONE';
const devicesWord = (n: number) => `${count(n)} ${n === 1 ? 'device' : 'devices'}`;

/** "Today, 4:12 PM · To everyone · Alert sent to 12 devices". */
function sentLine(message: AdminSentMessage) {
  const parts = [whenLabel(message.sentAt), `To ${message.toEmail ?? 'everyone'}`];
  if (message.alertsSent !== null) parts.push(`Alert sent to ${devicesWord(message.alertsSent)}`);
  return parts.join(' · ');
}

function SentRow({ message }: { message: AdminSentMessage }) {
  const remove = useRemoveMessage();
  const removed = message.removedAt !== null;
  return (
    <li className="flex items-start gap-4 border-t border-border-subtle px-6 py-3.5 text-sm max-md:px-4 max-md:text-[15px]">
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary max-md:text-[13px]">
          {sentLine(message)}
          {removed && <Tag>Removed</Tag>}
        </p>
        <p className={removed ? 'break-words text-text-tertiary' : 'break-words'}>{message.text}</p>
      </div>
      {!removed && (
        <Button
          size="sm"
          variant="secondary"
          loading={remove.isPending}
          onClick={() => remove.mutate(message.id)}
        >
          {remove.isPending ? 'Removing…' : 'Remove'}
        </Button>
      )}
    </li>
  );
}

/** The alert switch, with how many devices would get it. */
function AlertLine({
  checked,
  onChange,
  devices,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  devices: number;
}) {
  return (
    <span className="flex items-center gap-2.5 text-sm max-md:text-[15px]">
      <Switch
        label="Also send as an alert"
        checked={checked}
        onCheckedChange={onChange}
        disabled={devices === 0}
      />
      Also send as an alert
      <span className="text-text-tertiary">
        · {devices ? `${devicesWord(devices)} with alerts on` : 'no devices with alerts on'}
      </span>
    </span>
  );
}

/** The last 10 sent, newest first. */
function SentList({ sent }: { sent: ReturnType<typeof useSentMessages> }) {
  if (sent.isLoading) return <SkeletonList rows={2} label="Loading sent messages" />;
  if (sent.error) return <SectionError title="Could not load sent messages" />;
  if (!sent.data?.messages.length) return null;
  return (
    <ul aria-label="Sent messages">
      {sent.data.messages.map((message) => (
        <SentRow key={message.id} message={message} />
      ))}
    </ul>
  );
}

/**
 * Messages (owner, 18 Nov 2026, approved mock `OWNER-MESSAGES-mock/`): write to everyone or one
 * account; it shows at the top of their app until they close it, and can also go out as an alert.
 * Below, the last 10 sent, each with Remove.
 */
export function AdminMessages({ accounts }: { accounts: readonly AdminAccount[] }) {
  const sent = useSentMessages();
  const send = useSendMessage();
  const [to, setTo] = useState<string>(EVERYONE);
  const [text, setText] = useState('');
  const [alsoAlert, setAlsoAlert] = useState(false);
  const devices = sent.data?.alertDevices ?? {};
  const alertCount =
    to === EVERYONE ? Object.values(devices).reduce((sum, n) => sum + n, 0) : (devices[to] ?? 0);
  const options = [
    { value: EVERYONE, label: `Everyone · ${count(accounts.length)} accounts` },
    ...accounts.map((account) => ({ value: account.id, label: account.email })),
  ];
  const ready = text.trim().length > 0;
  return (
    <div className="panel max-md:rounded-2xl">
      <form
        className="flex flex-col gap-3.5 px-6 py-5 max-md:px-4 max-md:py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          send.mutate(
            { text: text.trim(), to, alsoAlert },
            {
              onSuccess: () => {
                setText('');
                setAlsoAlert(false);
              },
            },
          );
        }}
      >
        <Select
          label="To"
          options={options}
          value={to}
          onValueChange={setTo}
          className="max-w-sm"
        />
        <label htmlFor="owner-message" className="text-[13px] font-medium max-md:text-[15px]">
          Message
        </label>
        <Textarea
          id="owner-message"
          rows={3}
          maxLength={OWNER_MESSAGE_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="-mt-2 rounded-xl max-md:text-[17px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AlertLine checked={alsoAlert} onChange={setAlsoAlert} devices={alertCount} />
          <span className="flex items-center gap-3">
            <span className="text-xs text-text-secondary tabular-nums">
              {text.length} / {OWNER_MESSAGE_MAX_LENGTH}
            </span>
            <Button type="submit" disabled={!ready} loading={send.isPending}>
              {send.isPending ? 'Sending…' : 'Send'}
            </Button>
          </span>
        </div>
        {send.error && (
          <InlineNotification kind="error">The message was not sent. Try again.</InlineNotification>
        )}
      </form>
      <SentList sent={sent} />
    </div>
  );
}
