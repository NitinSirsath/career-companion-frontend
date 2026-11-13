import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Menu } from '@base-ui/react/menu';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useBreadcrumbSlot } from '../layout/breadcrumbSlot';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import { useMailsLists, useOpenMailsList, type MailsTab } from './mailsLists';

/**
 * The phone top bar's title on the Mails page (owner, 3 Nov 2026): "Job mails ▾" switches between
 * the three lists, so the tabs need no row of their own.
 */
export function MailsPhoneTitle({ tab }: { tab: MailsTab }) {
  const slot = useBreadcrumbSlot();
  const claim = slot?.claim;
  useLayoutEffect(() => claim?.(), [claim]);
  const lists = useMailsLists();
  const open = useOpenMailsList();
  if (!slot?.target) return null;
  const current = lists.find((list) => list.value === tab) ?? lists[0];
  return createPortal(
    <Menu.Root>
      <Menu.Trigger className="flex min-w-0 cursor-pointer items-center gap-1.5 text-base font-semibold text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus">
        <span className="truncate">{current.label}</span>
        <ChevronDownIcon size={16} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={10} className="z-50 outline-none">
          <Menu.Popup aria-label="Mail lists" className={`${POPUP_CLASS} min-w-60`}>
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
    </Menu.Root>,
    slot.target,
  );
}
