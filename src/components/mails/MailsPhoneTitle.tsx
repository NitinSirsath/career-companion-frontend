import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useGmailStatus } from '../../api/gmail';
import { mailsStatusWords } from '../../lib/mailsStatus';
import { cn } from '../../lib/utils';
import { ReadingStatusPanel } from '../layout/ReadingStatus';
import { useReadingView } from '../layout/useReadingView';
import { PhoneTitle } from '../phone/PhoneTitle';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import { Sheet } from '../ui/sheet';
import { useMailsLists, useOpenMailsList, type MailsTab } from './mailsLists';

/** "Job mails ⌄": the big title is also the way to the other two lists (owner, 3 and 13 Nov 2026). */
function ListMenu({ tab }: { tab: MailsTab }) {
  const lists = useMailsLists();
  const open = useOpenMailsList();
  const current = lists.find((list) => list.value === tab) ?? lists[0];
  return (
    <Menu.Root>
      <Menu.Trigger className="inline-flex max-w-full cursor-pointer items-center gap-1.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-border-focus">
        <span className="truncate">{current.label}</span>
        <ChevronDownIcon size={22} aria-hidden="true" className="shrink-0 text-text-tertiary" />
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
 * One line under the Mails title (owner, 13 Nov 2026): when mail last came in and what the AI is
 * doing ("Synced 12:00 PM · 3 new mails wait for AI ›"). A tap opens the full AI reading status.
 * It replaces the status cell that sat in the phone's top bar.
 */
function StatusLine() {
  const gmail = useGmailStatus();
  const view = useReadingView();
  const [open, setOpen] = useState(false);
  const words = mailsStatusWords(gmail.data, view);
  if (!words.synced && !words.ai) return null;
  const line = (
    <>
      {words.synced}
      {words.synced && words.ai && ' · '}
      {words.ai && <span className={cn(words.working && 'ai-shimmer')}>{words.ai}</span>}
    </>
  );
  if (!view) return <p className="mt-[3px] text-[15px] leading-5 text-text-secondary">{line}</p>;
  return (
    <>
      <button
        type="button"
        aria-label={`AI reading status: ${view.words.title}`}
        onClick={() => setOpen(true)}
        className="mt-[3px] inline-flex max-w-full cursor-pointer items-center gap-1 text-left text-[15px] leading-5 text-text-secondary active:opacity-50"
      >
        <span className="min-w-0">{line}</span>
        <ChevronRightIcon size={15} aria-hidden="true" className="shrink-0" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="AI reading status">
        <ReadingStatusPanel view={view} />
      </Sheet>
    </>
  );
}

/** The top of the Mails page on phones: the big title with the lists, and the status line. */
export function MailsPhoneTitle({ tab }: { tab: MailsTab }) {
  const lists = useMailsLists();
  const label = (lists.find((list) => list.value === tab) ?? lists[0]).label;
  return (
    <div className="flex flex-col px-1 pt-0.5 pb-3">
      <PhoneTitle barTitle={label}>
        <ListMenu tab={tab} />
      </PhoneTitle>
      <StatusLine />
    </div>
  );
}
