import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Link } from '@tanstack/react-router';
import { Close, OverflowMenuHorizontal, User as UserIcon } from '@carbon/icons-react';
import { useSandboxMailbox } from '../../api/appMode';
import type { User } from '../../api/auth';
import { THEME_CHOICES } from '../../lib/theme';
import { cn } from '../../lib/utils';
import { useTheme } from '../ThemeProvider';
import { Avatar } from '../ui/avatar';
import { logOutAndLeave } from './AccountMenu';
import { MAIN_NAV, rememberedSearch, SANDBOX_NAV, SETTINGS_NAV, type NavItem } from './navItems';

const BAR_ITEM =
  'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs text-text-secondary transition-colors duration-70 ease-standard [&.active]:bg-tint [&.active]:text-tint-text [&.active_svg]:text-link';

const SHEET_ROW =
  'flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover';

function SheetLink({ item, onPick }: { item: NavItem; onPick: () => void }) {
  const Icon = item.icon;
  return (
    <Link to={item.to} className={SHEET_ROW} onClick={onPick}>
      <Icon size={16} aria-hidden="true" />
      {item.label}
    </Link>
  );
}

/** Everything that is not in the bottom bar: settings, the sandbox, the account and the theme. */
function MoreSheet({ user, onPick }: { user: User | null; onPick: () => void }) {
  const sandbox = useSandboxMailbox();
  const { theme, setTheme } = useTheme();
  const name = user?.name || user?.email || 'Account';
  return (
    <div className="flex flex-col pb-4">
      <div className="flex items-center gap-3 border-b border-border-subtle p-4 pr-14">
        <Avatar name={name} me />
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{name}</span>
          {user?.email && (
            <span className="truncate text-xs text-text-secondary">{user.email}</span>
          )}
        </span>
      </div>
      <p className="px-4 pt-4 pb-1 text-xs text-text-secondary">Settings</p>
      {SETTINGS_NAV.map((item) => (
        <SheetLink key={item.to} item={item} onPick={onPick} />
      ))}
      {sandbox && <SheetLink item={SANDBOX_NAV} onPick={onPick} />}
      <p className="mt-2 border-t border-border-subtle px-4 pt-4 pb-2 text-xs text-text-secondary">
        Theme
      </p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="mx-4 grid grid-cols-3 border border-border-strong"
      >
        {THEME_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={theme === choice.value}
            onClick={() => setTheme(choice.value)}
            className={cn(
              'h-11 cursor-pointer text-sm text-text-secondary transition-colors duration-110 ease-standard',
              theme === choice.value && 'bg-text-primary text-background',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <Link
        to="/account"
        className={cn(SHEET_ROW, 'mt-4 border-t border-border-subtle')}
        onClick={onPick}
      >
        <UserIcon size={16} aria-hidden="true" />
        Account
      </Link>
      <button
        type="button"
        className={cn(SHEET_ROW, 'border-t border-border-subtle')}
        onClick={() => void logOutAndLeave()}
      >
        Log out
      </button>
    </div>
  );
}

/** The bottom bar on phones: the three daily pages and More. */
export function MobileNav({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav
        aria-label="Main"
        className="pb-safe fixed right-0 bottom-0 left-0 z-40 grid h-16 grid-cols-4 border-t border-border-subtle bg-surface md:hidden"
      >
        {MAIN_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              search={rememberedSearch(item.to)}
              className={BAR_ITEM}
            >
              <Icon size={20} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          className={BAR_ITEM}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <OverflowMenuHorizontal size={20} aria-hidden="true" />
          More
        </button>
      </nav>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-240 ease-entrance data-ending-style:opacity-0 data-starting-style:opacity-0 md:hidden" />
          <Dialog.Popup className="fixed right-0 bottom-0 left-0 z-50 max-h-[85vh] overflow-y-auto bg-surface text-text-primary outline-none transition-transform duration-240 ease-entrance data-ending-style:translate-y-full data-ending-style:ease-exit data-starting-style:translate-y-full md:hidden">
            <Dialog.Title className="sr-only">More</Dialog.Title>
            <MoreSheet user={user} onPick={() => setOpen(false)} />
            <Dialog.Close
              aria-label="Close"
              className="absolute top-0 right-0 flex size-12 cursor-pointer items-center justify-center"
            >
              <Close size={20} aria-hidden="true" />
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
