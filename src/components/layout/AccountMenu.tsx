import { Menu } from '@base-ui/react/menu';
import { Checkmark } from '@carbon/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { logout, type User } from '../../api/auth';
import { THEME_CHOICES } from '../../lib/theme';
import { cn } from '../../lib/utils';
import { useTheme } from '../ThemeProvider';
import { Avatar } from '../ui/avatar';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';

export async function logOutAndLeave() {
  await logout();
  window.location.href = '/login';
}

/** Who is signed in; opens Account, the theme and Log out. */
export function AccountMenu({ user, collapsed }: { user: User | null; collapsed: boolean }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const name = user?.name || user?.email || 'Account';
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className="flex h-14 w-full shrink-0 cursor-pointer items-center gap-3 border-t border-border-subtle px-3 text-left transition-colors duration-70 ease-standard hover:bg-layer-hover data-popup-open:bg-layer-hover"
      >
        <Avatar name={name} me size="sm" />
        <span className={cn('flex min-w-0 flex-col leading-4', collapsed && 'sr-only')}>
          <span className="truncate text-sm text-text-primary">{name}</span>
          {user?.email && user.email !== name && (
            <span className="truncate text-xs text-text-secondary">{user.email}</span>
          )}
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={4} className="z-50 outline-none">
          <Menu.Popup className={cn(POPUP_CLASS, 'w-60')}>
            {user && (
              <div className="border-b border-border-default px-4 pt-2 pb-3">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-text-secondary">{user.email}</p>
              </div>
            )}
            <Menu.Item className={ITEM_CLASS} onClick={() => void navigate({ to: '/account' })}>
              Account
            </Menu.Item>
            <Menu.Group>
              <Menu.GroupLabel className="px-4 pt-2 pb-1 text-xs text-text-tertiary">
                Theme
              </Menu.GroupLabel>
              <Menu.RadioGroup value={theme} onValueChange={(next) => setTheme(next)}>
                {THEME_CHOICES.map((choice) => (
                  <Menu.RadioItem
                    key={choice.value}
                    value={choice.value}
                    closeOnClick
                    className={ITEM_CLASS}
                  >
                    {choice.label}
                    <Menu.RadioItemIndicator className="flex text-link">
                      <Checkmark size={16} aria-hidden="true" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            <Menu.Separator className="my-1 h-px bg-border-default" />
            <Menu.Item className={ITEM_CLASS} onClick={() => void logOutAndLeave()}>
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
