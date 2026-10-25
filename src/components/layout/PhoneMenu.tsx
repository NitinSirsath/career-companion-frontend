import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Link } from '@tanstack/react-router';
import { Close, Menu } from '@carbon/icons-react';
import { useDevMode, useSandboxMailbox } from '../../api/appMode';
import { cn } from '../../lib/utils';
import { Wordmark } from './Logo';
import {
  MAIN_NAV,
  NAV_LINK_CLASS,
  rememberedSearch,
  SANDBOX_NAV,
  SETTINGS_NAV,
  type NavItem,
} from './navItems';

const CELL =
  'flex w-12 shrink-0 cursor-pointer items-center justify-center text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover';

function MenuLink({ item, badge, onPick }: { item: NavItem; badge?: string; onPick: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      search={rememberedSearch(item.to)}
      className={cn(NAV_LINK_CLASS, 'h-12 text-base')}
      onClick={onPick}
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badge && (
        <span className="bg-tag-yellow-bg px-1.5 text-[12px] leading-5 text-tag-yellow">
          {badge}
        </span>
      )}
    </Link>
  );
}

/**
 * The phone menu: the first cell of the top bar opens a drawer from the left with every page, as
 * the side menu does on laptops.
 */
export function PhoneMenu() {
  const [open, setOpen] = useState(false);
  const devMode = useDevMode();
  const sandbox = useSandboxMailbox();
  const close = () => setOpen(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open menu"
        className={cn(CELL, 'border-r border-border-subtle md:hidden')}
      >
        <Menu size={20} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-240 ease-entrance data-ending-style:opacity-0 data-starting-style:opacity-0 md:hidden" />
        <Dialog.Popup className="fixed top-0 bottom-0 left-0 z-50 flex w-[calc(100%-3.5rem)] max-w-80 flex-col border-r border-border-subtle bg-background text-text-primary outline-none transition-[translate] duration-240 ease-entrance data-ending-style:-translate-x-full data-ending-style:ease-exit data-starting-style:-translate-x-full md:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="flex h-14 shrink-0 items-stretch border-b border-border-subtle">
            <span className="flex min-w-0 flex-1 items-center">
              <Wordmark size={20} className="px-4" />
            </span>
            <Dialog.Close
              aria-label="Close menu"
              className={cn(CELL, 'border-l border-border-subtle')}
            >
              <Close size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <nav aria-label="Menu" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {MAIN_NAV.map((item) => (
              <MenuLink key={item.to} item={item} onPick={close} />
            ))}
            <p className="px-3 pt-6 pb-2 text-xs text-text-secondary">Settings</p>
            {SETTINGS_NAV.map((item) => (
              <MenuLink key={item.to} item={item} onPick={close} />
            ))}
            {sandbox && (
              <MenuLink item={SANDBOX_NAV} badge={devMode ? 'Dev' : 'Test'} onPick={close} />
            )}
          </nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
