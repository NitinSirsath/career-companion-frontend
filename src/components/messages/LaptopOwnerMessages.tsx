import { format, isToday } from 'date-fns';
import { XIcon } from 'lucide-react';
import { useDismissMessage, useMyMessages } from '../../api/messages';

const when = (iso: string) => {
  const date = new Date(iso);
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'MMM d');
};

/**
 * Messages from NorthList's owner on laptops (laptop v2, owner 18 Nov 2026,
 * `PHONE-LINEAR-mock/desktop.html` section 5): at the top of every page, newest first, each a plain
 * grey card with the blue dot instead of a blue box. × closes it everywhere. Plain text only.
 */
export function LaptopOwnerMessages() {
  const { data } = useMyMessages();
  const dismiss = useDismissMessage();
  if (!data?.messages.length) return null;
  return (
    <section aria-label="Messages from NorthList" className="mb-6 flex flex-col gap-2">
      {data.messages.map((message) => (
        <div
          key={message.id}
          className="flex items-start gap-2.5 rounded-xl bg-surface-subtle py-2.5 pr-2.5 pl-3.5 text-sm leading-5 text-text-primary"
        >
          <span aria-hidden="true" className="mt-1.5 size-[7px] shrink-0 rounded-full bg-link" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-[18px] text-text-secondary">
              Message from NorthList · {when(message.sentAt)}
            </p>
            <p className="break-words whitespace-pre-line">{message.text}</p>
          </div>
          <button
            type="button"
            aria-label="Close message"
            onClick={() => dismiss.mutate(message.id)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary"
          >
            <XIcon size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </section>
  );
}
