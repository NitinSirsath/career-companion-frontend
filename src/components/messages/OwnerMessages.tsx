import { format, isToday } from 'date-fns';
import { MegaphoneIcon, XIcon } from 'lucide-react';
import { useDismissMessage, useMyMessages } from '../../api/messages';
import { cn } from '../../lib/utils';

const when = (iso: string) => {
  const date = new Date(iso);
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'MMM d');
};

/**
 * Messages from NorthList's owner (owner, 18 Nov 2026, approved mock `OWNER-MESSAGES-mock/`): at
 * the top of every page until the user closes them, newest first. Plain text only.
 */
export function OwnerMessages({ phone = false }: { phone?: boolean }) {
  const { data } = useMyMessages();
  const dismiss = useDismissMessage();
  if (!data?.messages.length) return null;
  return (
    <section
      aria-label="Messages from NorthList"
      className={cn('flex flex-col gap-2', phone ? 'mb-3' : 'mb-6')}
    >
      {data.messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'flex items-start gap-3 bg-tag-blue-bg py-3 pr-3 pl-4 text-text-primary shadow-[inset_0_0_0_1px_var(--tag-blue-ring)]',
            phone ? 'rounded-2xl text-[15px] leading-5' : 'rounded-[14px] text-sm leading-5',
          )}
        >
          <MegaphoneIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-link" />
          <div className="min-w-0 flex-1">
            <p className={cn('text-text-secondary', phone ? 'text-[13px]' : 'text-xs')}>
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
