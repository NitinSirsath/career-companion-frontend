import { Link, useRouterState } from '@tanstack/react-router';
import type { User } from '../../api/auth';
import { cn } from '../../lib/utils';
import { DevModeBanner } from '../devMode/DevModeBanner';
import { AccountMenu } from './AccountMenu';
import { SectionCrumb } from './Breadcrumb';
import { useBreadcrumbSlot } from './breadcrumbSlot';
import { Logo, Wordmark } from './Logo';

/**
 * The bar across the top of the signed-in app on laptops: the name in a cell as wide as the side
 * menu (the mark alone when the menu is collapsed), the breadcrumb, the dev mode chip and the
 * account button. Phones have their own frame (`PhoneShell`).
 */
export function TopBar({ user, collapsed }: { user: User | null; collapsed: boolean }) {
  const slot = useBreadcrumbSlot();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const claimed = !!slot?.claimed;
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-stretch border-b border-[var(--shell-line)] bg-canvas">
      <Link
        to="/dashboard"
        aria-label="NorthList"
        className={cn(
          'hidden min-w-0 items-center overflow-hidden border-r border-[var(--shell-line)] transition-[width] duration-240 ease-standard md:flex md:shrink-0',
          collapsed ? 'md:w-14' : 'md:w-72',
        )}
      >
        {collapsed ? (
          <span className="flex size-14 shrink-0 items-center justify-center">
            <Logo />
          </span>
        ) : (
          <Wordmark className="px-5" />
        )}
      </Link>
      <div ref={slot?.setTarget} className="flex min-w-0 flex-1 items-center px-3 md:px-6">
        {!claimed && <SectionCrumb path={path} />}
      </div>
      <DevModeBanner />
      <AccountMenu user={user} />
    </header>
  );
}
