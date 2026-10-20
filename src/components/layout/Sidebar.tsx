import { Link } from '@tanstack/react-router';
import { Portfolio, SidePanelClose, SidePanelOpen } from '@carbon/icons-react';
import { useDevMode, useSandboxMailbox } from '../../api/appMode';
import type { User } from '../../api/auth';
import { cn } from '../../lib/utils';
import { AccountMenu } from './AccountMenu';
import { MAIN_NAV, rememberedSearch, SANDBOX_NAV, SETTINGS_NAV, type NavItem } from './navItems';
import { useMenuCollapsed } from './useMenuCollapsed';

const LINK_CLASS =
  'flex h-10 items-center gap-3 overflow-hidden px-4 text-sm whitespace-nowrap text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary [&.active]:bg-surface-selected [&.active]:font-semibold [&.active]:text-text-primary [&.active_svg]:text-link';

function NavLink({
  item,
  collapsed,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  badge?: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      search={rememberedSearch(item.to)}
      className={LINK_CLASS}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className={cn('flex-1', collapsed && 'sr-only')}>{item.label}</span>
      {badge && !collapsed && (
        <span className="bg-tag-yellow-bg px-1.5 text-[11px] leading-5 text-tag-yellow">
          {badge}
        </span>
      )}
    </Link>
  );
}

/** The side menu on laptops: daily pages, then settings; it can shrink to icons. */
export function Sidebar({ user }: { user: User | null }) {
  const devMode = useDevMode();
  const sandbox = useSandboxMailbox();
  const [collapsed, setCollapsed] = useMenuCollapsed();
  const ToggleIcon = collapsed ? SidePanelOpen : SidePanelClose;
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border-subtle bg-surface transition-[width] duration-240 ease-standard md:flex',
        collapsed ? 'w-12' : 'w-64',
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-3 overflow-hidden border-b border-border-subtle px-4">
        <Portfolio size={16} aria-hidden="true" className="shrink-0 text-link" />
        <span className={cn('font-semibold whitespace-nowrap', collapsed && 'sr-only')}>
          Career Companion
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-x-hidden overflow-y-auto py-2">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.to} item={item} collapsed={collapsed} />
        ))}
        <div className="mt-2 border-t border-border-subtle pt-2">
          <p
            className={cn(
              'px-4 pt-2 pb-1 text-xs tracking-[0.32px] text-text-tertiary',
              collapsed && 'sr-only',
            )}
          >
            Settings
          </p>
          {SETTINGS_NAV.map((item) => (
            <NavLink key={item.to} item={item} collapsed={collapsed} />
          ))}
          {sandbox && (
            <NavLink item={SANDBOX_NAV} collapsed={collapsed} badge={devMode ? 'Dev' : 'Test'} />
          )}
        </div>
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        title={collapsed ? 'Expand menu' : undefined}
        className="flex h-10 shrink-0 cursor-pointer items-center gap-3 overflow-hidden border-t border-border-subtle px-4 text-sm whitespace-nowrap text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary"
      >
        <ToggleIcon size={16} aria-hidden="true" className="shrink-0" />
        <span className={cn(collapsed && 'sr-only')}>Collapse menu</span>
      </button>
      <AccountMenu user={user} collapsed={collapsed} />
    </aside>
  );
}
