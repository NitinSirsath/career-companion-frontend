import { Link } from '@tanstack/react-router';
import { SidePanelClose, SidePanelOpen } from '@carbon/icons-react';
import { useDevMode, useSandboxMailbox } from '../../api/appMode';
import { cn } from '../../lib/utils';
import { ReadingStatus } from './ReadingStatus';
import { useIsPhone } from './useIsPhone';
import {
  MAIN_NAV,
  NAV_LINK_CLASS,
  rememberedSearch,
  SANDBOX_NAV,
  SETTINGS_NAV,
  type NavItem,
} from './navItems';

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
      className={NAV_LINK_CLASS}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className={cn('flex-1', collapsed && 'sr-only')}>{item.label}</span>
      {badge && !collapsed && (
        <span className="bg-tag-yellow-bg px-1.5 text-[12px] leading-5 text-tag-yellow">
          {badge}
        </span>
      )}
    </Link>
  );
}

/**
 * The side menu on laptops, under the top bar: daily pages, then settings, and the AI reading
 * status at the bottom; it can shrink to icons.
 */
export function Sidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const devMode = useDevMode();
  const sandbox = useSandboxMailbox();
  const ToggleIcon = collapsed ? SidePanelOpen : SidePanelClose;
  // Phones show the reading status in the top bar instead.
  const phone = useIsPhone();
  return (
    <aside
      className={cn(
        'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-border-subtle bg-background transition-[width] duration-240 ease-standard md:flex',
        collapsed ? 'w-14' : 'w-72',
      )}
    >
      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2 pt-4 pb-6"
      >
        {MAIN_NAV.map((item) => (
          <NavLink key={item.to} item={item} collapsed={collapsed} />
        ))}
        <p
          className={cn(
            'px-3 pt-6 pb-2 text-xs whitespace-nowrap text-text-secondary',
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
      </nav>

      {!phone && <ReadingStatus collapsed={collapsed} />}
      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        title={collapsed ? 'Expand menu' : undefined}
        className="flex h-12 shrink-0 cursor-pointer items-center gap-3 overflow-hidden border-t border-border-subtle px-5 text-[14px] leading-5 font-medium whitespace-nowrap text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover"
      >
        <ToggleIcon size={16} aria-hidden="true" className="shrink-0 text-text-secondary" />
        <span className={cn(collapsed && 'sr-only')}>Collapse menu</span>
      </button>
    </aside>
  );
}
