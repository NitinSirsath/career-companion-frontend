import { ArrowUpIcon, XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { replyChoice, type ReplyProblem } from '../../lib/mailReply';
import { parseSender } from '../../lib/mails';
import { useIsPhone } from '../layout/useIsPhone';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Select } from '../ui/select';
import { Spinner } from '../ui/spinner';

/** The small parts of the reply box: what became of a send, Send, who gets the reply, Close. */

/** What became of the last send: sent, not confirmed, or not sent. */
export function ReplyOutcome({
  sentNote,
  problem,
}: {
  sentNote: string | null;
  problem: ReplyProblem | null;
}) {
  if (sentNote) return <InlineNotification kind="success">{sentNote}</InlineNotification>;
  if (problem?.kind === 'unconfirmed')
    return (
      <InlineNotification kind="error" title="Could not confirm that your reply was sent.">
        Gmail did not answer in time. The reply may have gone out. Check the conversation before you
        send it again, so the same mail does not go out twice.
      </InlineNotification>
    );
  if (problem?.kind === 'not-sent')
    return <InlineNotification kind="error">{problem.message}</InlineNotification>;
  return null;
}

/** "Send reply", or "Send" in the phone's top bar; "Sending…" while it sends. */
function sendLabel(pending: boolean, short: boolean) {
  if (pending) return 'Sending…';
  return short ? 'Send' : 'Send reply';
}

/** After a send that could not be confirmed, sending again is a choice of its own. */
export function ReplyButtons({
  unconfirmed,
  pending,
  onCheck,
  onSendAgain,
  form,
  short = false,
  empty = false,
}: {
  unconfirmed: boolean;
  pending: boolean;
  onCheck: () => void;
  onSendAgain: () => void;
  /** The form's id, for a Send button outside it (the phone's top bar). */
  form?: string;
  /** "Send" instead of "Send reply": the phone's top bar, 44 px high. */
  short?: boolean;
  /** No text yet: the phone's Send is grey until there is some, as in iPhone Mail. */
  empty?: boolean;
}) {
  // Phones: a round ↑ in the accent in the sheet's top bar (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #4).
  if (!unconfirmed && short)
    return (
      <button
        type="submit"
        form={form}
        disabled={empty || pending}
        aria-busy={pending || undefined}
        aria-label={pending ? 'Sending…' : 'Send'}
        title="Send reply (⌘ Enter)"
        className="flex size-[38px] cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent transition-[opacity,scale] duration-450 ease-[cubic-bezier(0.25,1.6,0.4,1)] active:scale-110 active:duration-120 disabled:cursor-default disabled:opacity-40"
      >
        {pending ? <Spinner /> : <ArrowUpIcon size={18} strokeWidth={2.4} aria-hidden="true" />}
      </button>
    );
  if (!unconfirmed)
    return (
      <Button
        type="submit"
        form={form}
        loading={pending}
        disabled={short && empty}
        title="Send reply (⌘ Enter)"
        className={cn(
          short &&
            'h-11 px-[18px] text-[16px] leading-5 font-semibold disabled:cursor-default disabled:bg-layer-accent disabled:text-text-tertiary',
        )}
      >
        {sendLabel(pending, short)}
      </Button>
    );
  return (
    <>
      <Button type="button" variant="tertiary" onClick={onCheck}>
        Check the conversation
      </Button>
      <Button type="button" disabled={pending} onClick={onSendAgain}>
        {pending ? 'Sending…' : 'Send again'}
      </Button>
    </>
  );
}

/**
 * Who the reply reaches. With other people on the mail it goes to all of them, unless the user
 * chooses the sender alone. These are the only two choices: no address is typed or removed.
 */
export function ReplyReceivers({
  replyTo,
  others,
  toAll,
  onToAll,
}: {
  replyTo: string;
  others: string[];
  toAll: boolean;
  onToAll: (toAll: boolean) => void;
}) {
  const phone = useIsPhone();
  const line = (label: string, people: string[]) =>
    // Phones: a plain row with each person as a pill with their picture (mock #4).
    phone ? (
      <span className="-mx-4 flex min-w-0 flex-wrap items-center gap-2.5 border-b border-border-subtle px-[18px] py-[9px] text-[14.5px]">
        <span className="w-[26px] text-text-secondary">{label}</span>
        {people.map((person) => {
          const name = parseSender(person).name;
          return (
            <span
              key={person}
              className="inline-flex h-[27px] max-w-full items-center gap-1.5 rounded-full bg-[var(--glass-pill)] pr-2.5 pl-1 text-[13.5px] font-medium"
            >
              <Avatar name={name} className="size-5 text-[8.5px]" />
              <span className="truncate">{name}</span>
            </span>
          );
        })}
      </span>
    ) : (
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="w-6 text-xs text-text-secondary">{label}</span>
        {people.map((person) => (
          <span
            key={person}
            className="rounded-full bg-tag-gray-bg px-2.5 text-xs leading-6 text-tag-gray"
          >
            {parseSender(person).name}
          </span>
        ))}
      </span>
    );
  const chips = (
    <span className={cn('flex min-w-0 flex-col', !phone && 'gap-1')}>
      {line('To', [replyTo])}
      {toAll && line('Cc', others)}
    </span>
  );
  if (!others.length) return chips;
  const choice = replyChoice(replyTo, others, toAll);
  const all = replyChoice(replyTo, others, true);
  const one = replyChoice(replyTo, others, false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {chips}
        <Select<'all' | 'one'>
          label="Who gets this reply"
          hideLabel
          className="w-64"
          value={toAll ? 'all' : 'one'}
          options={[
            { value: 'all', label: all.title },
            { value: 'one', label: one.title },
          ]}
          onValueChange={(next) => onToAll(next === 'all')}
        />
      </div>
      {choice.leftOut && <p className="text-xs text-text-secondary">{choice.leftOut}</p>}
    </div>
  );
}

/** The round × at the top right of the box on laptops (owner, 13 Nov 2026). */
export function CloseReply({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close reply"
      title="Close (Esc). Your text is kept."
      onClick={onClose}
      className="absolute top-2 right-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary"
    >
      <XIcon size={18} aria-hidden="true" />
    </button>
  );
}

/** "Not sent yet. Kept on this device only." with Discard, when the box opened with kept text. */
export function KeptLine({ onDiscard, phone }: { onDiscard: () => void; phone: boolean }) {
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-3 pb-1 text-xs text-text-secondary',
        !phone && 'px-4',
      )}
    >
      Not sent yet. Kept on this device only.
      <button
        type="button"
        onClick={onDiscard}
        className="cursor-pointer text-link hover:underline"
      >
        Discard
      </button>
    </p>
  );
}

/** While the editor loads: the same room, so nothing jumps. */
export function EditorLoading() {
  return <div className="min-h-[164px] px-4 pt-3 text-sm text-text-tertiary">Write your reply</div>;
}
