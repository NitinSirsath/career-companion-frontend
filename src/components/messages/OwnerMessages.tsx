import { format, isToday } from 'date-fns';
import { XIcon } from 'lucide-react';
import { useDismissMessage, useMyMessages } from '../../api/messages';

const when = (iso: string) => {
  const date = new Date(iso);
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'MMM d');
};

/** One message on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 11): a plain card. */
function PhoneMessage({
  message,
  onClose,
}: {
  message: { id: string; text: string; sentAt: string };
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-[18px] bg-surface-subtle py-[11px] pr-2.5 pl-3.5 text-text-primary">
      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-link" />
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[12.5px] leading-4 text-text-secondary">
          Message from NorthList · {when(message.sentAt)}
        </p>
        <p className="text-[14px] leading-[1.4] break-words whitespace-pre-line">{message.text}</p>
      </div>
      <button
        type="button"
        aria-label="Close message"
        onClick={onClose}
        className="-mt-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-[background-color] duration-450 active:bg-surface-selected active:duration-0"
      >
        <XIcon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Messages from NorthList's owner on phones (owner, 18 Nov 2026, approved mock `OWNER-MESSAGES-mock/`):
 * at the top of every page until the user closes them, newest first. Plain text only. A plain card
 * with the blue dot, under the page title (mock `PHONE-LINEAR-mock/` screen 11). Laptops use
 * `LaptopOwnerMessages`.
 */
export function OwnerMessages() {
  const { data } = useMyMessages();
  const dismiss = useDismissMessage();
  if (!data?.messages.length) return null;
  return (
    <section aria-label="Messages from NorthList" className="mb-3 flex flex-col gap-2">
      {data.messages.map((message) => (
        <PhoneMessage
          key={message.id}
          message={message}
          onClose={() => dismiss.mutate(message.id)}
        />
      ))}
    </section>
  );
}
