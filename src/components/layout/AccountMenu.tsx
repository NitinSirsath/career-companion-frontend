import { Menu } from '@base-ui/react/menu';
import { Checkmark } from '@carbon/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { logout, type User } from '../../api/auth';
import { dropAllKeptReplies } from '../../lib/keptReply';
import { THEME_CHOICES } from '../../lib/theme';
import { cn } from '../../lib/utils';
import { useTheme } from '../ThemeProvider';
import { Avatar } from '../ui/avatar';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';

export async function logOutAndLeave() {
  // Unsent replies kept in this browser go too: the next person here sees none.
  dropAllKeptReplies();
  await logout();
  window.location.href = '/login';
}

/** The round picture at the right of the top bar; opens Account, the theme and Log out. */
export function AccountMenu({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const name = user?.name || user?.email || 'Account';
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className="flex w-12 shrink-0 md:w-14 cursor-pointer items-center justify-center border-l border-border-subtle transition-colors duration-70 ease-standard hover:bg-layer-hover data-popup-open:bg-layer-hover"
      >
        <Avatar name={name} me className="size-7 text-[13px]" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={0} className="z-50 outline-none">
          <Menu.Popup className={cn(POPUP_CLASS, 'w-65')}>
            {user && (
              <div className="mb-1 border-b border-border-subtle px-4 pt-2 pb-3">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-text-secondary">{user.email}</p>
              </div>
            )}
            <Menu.Item className={ITEM_CLASS} onClick={() => void navigate({ to: '/account' })}>
              Account
            </Menu.Item>
            <Menu.Group>
              <Menu.GroupLabel className="px-4 pt-2 pb-1 text-xs text-text-secondary">
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
            <Menu.Separator className="my-1 h-px bg-border-subtle" />
            <Menu.Item className={ITEM_CLASS} onClick={() => void logOutAndLeave()}>
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
