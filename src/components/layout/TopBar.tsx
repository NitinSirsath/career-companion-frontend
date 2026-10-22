import { Link, useRouterState } from '@tanstack/react-router';
import type { User } from '../../api/auth';
import { cn } from '../../lib/utils';
import { DevModeBanner } from '../devMode/DevModeBanner';
import { AccountMenu } from './AccountMenu';
import { SectionCrumb } from './Breadcrumb';
import { useBreadcrumbSlot } from './breadcrumbSlot';
import { Logo } from './Logo';

/**
 * The bar across the top of the signed-in app: the logo in a cell as wide as the side menu, the
 * breadcrumb, the dev mode chip and the account button. On phones: the logo, the way back, and
 * the account button.
 */
export function TopBar({ user, collapsed }: { user: User | null; collapsed: boolean }) {
  const slot = useBreadcrumbSlot();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const claimed = !!slot?.claimed;
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-stretch border-b border-border-subtle bg-background">
      <Link
        to="/mails"
        aria-label="Career Companion"
        className={cn(
          'flex min-w-0 items-center overflow-hidden text-text-primary transition-[width] duration-240 ease-standard md:shrink-0',
          collapsed ? 'md:w-14' : 'md:w-72 md:border-r md:border-border-subtle',
        )}
      >
        <span className="flex size-14 shrink-0 items-center justify-center border-r border-border-subtle">
          <Logo />
        </span>
        <span
          className={cn(
            'truncate px-3 font-medium whitespace-nowrap md:px-4',
            claimed && 'hidden md:block',
            collapsed && 'md:hidden',
          )}
        >
          Career Companion
        </span>
      </Link>
      <div ref={slot?.setTarget} className="flex min-w-0 flex-1 items-center px-1 md:px-6">
        {!claimed && <SectionCrumb path={path} />}
      </div>
      <DevModeBanner />
      <AccountMenu user={user} />
    </header>
  );
}
