import { Menu } from '@base-ui/react/menu';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useGmailStatus } from '../../api/gmail';
import { mailsStatusWords } from '../../lib/mailsStatus';
import { cn } from '../../lib/utils';
import { ReadingStatusPanel } from '../layout/ReadingStatus';
import { useReadingView } from '../layout/useReadingView';
import { PhoneTitle } from '../phone/PhoneTitle';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import { Sheet } from '../ui/sheet';
import { useMailsLists, useOpenMailsList, type MailsTab } from './mailsLists';

/** The big title's words on phones (owner, 18 Nov 2026): "Mails" for the job mails, else the list. */
function titleWords(tab: MailsTab, label: string) {
  return tab === 'job' ? 'Mails' : label;
}

/** "Mails ⌄": the big title is also the way to the other two lists (owner, 3 and 13 Nov 2026). */
function ListMenu({ tab }: { tab: MailsTab }) {
  const lists = useMailsLists();
  const open = useOpenMailsList();
  const current = lists.find((list) => list.value === tab) ?? lists[0];
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${current.label}. Show another list`}
        className="group inline-flex max-w-full cursor-pointer items-center gap-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
      >
        <span className="truncate">{titleWords(tab, current.label)}</span>
        <ChevronDownIcon
          size={20}
          aria-hidden="true"
          className="mt-1 shrink-0 text-text-tertiary transition-transform duration-240 ease-spring group-data-[popup-open]:rotate-180"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup aria-label="Mail lists" className={cn(POPUP_CLASS, 'phone-type min-w-60')}>
            {lists.map((list) => (
              <Menu.Item key={list.value} className={ITEM_CLASS} onClick={() => open(list.value)}>
                <span className="flex items-center gap-3">
                  <span className="flex w-4 text-link">
                    {list.value === tab && <CheckIcon size={16} aria-label="Shown" />}
                  </span>
                  {list.label}
                </span>
                {'count' in list && list.count !== undefined && (
                  <span className="text-text-tertiary tabular-nums">{list.count}</span>
                )}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * The first line of the Mails ··· menu (owner, 18 Nov 2026; it sat under the title before): when
 * mail last came in and what the AI is doing ("Synced 12:00 PM · 3 new mails wait for AI"). With
 * an AI status, picking it opens the full AI reading status (`onOpenStatus`).
 */
export function MailsSyncItem({ onOpenStatus }: { onOpenStatus: () => void }) {
  const gmail = useGmailStatus();
  const view = useReadingView();
  const words = mailsStatusWords(gmail.data, view);
  if (!words.synced && !words.ai) return null;
  const line = (
    <span className="flex min-w-0 flex-col text-[13px] leading-[18px] text-text-secondary">
      {words.synced && <span>{words.synced}</span>}
      {words.ai && <span className={cn(words.working && 'ai-shimmer')}>{words.ai}</span>}
    </span>
  );
  return (
    <>
      {view ? (
        <Menu.Item
          aria-label={`AI reading status: ${view.words.title}`}
          className={cn(ITEM_CLASS, 'justify-start')}
          onClick={onOpenStatus}
        >
          {line}
        </Menu.Item>
      ) : (
        <div className="px-4 py-2">{line}</div>
      )}
      <Menu.Separator className="my-1 h-px bg-border-subtle" />
    </>
  );
}

/** The full AI reading status in a sheet, opened from the Mails ··· menu. */
export function MailsStatusSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const view = useReadingView();
  if (!view) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="AI reading status">
      <ReadingStatusPanel view={view} />
    </Sheet>
  );
}

/**
 * The Mails title on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #1): "Mails" in big
 * bold type, in the same row as the glass Filter and ··· capsule, like Linear's Inbox.
 */
export function MailsPhoneTitle({ tab }: { tab: MailsTab }) {
  const lists = useMailsLists();
  const label = titleWords(tab, (lists.find((list) => list.value === tab) ?? lists[0]).label);
  return (
    // The shell puts the list title in the first row, beside the capsule.
    <PhoneTitle barTitle={label}>
      <ListMenu tab={tab} />
    </PhoneTitle>
  );
}
