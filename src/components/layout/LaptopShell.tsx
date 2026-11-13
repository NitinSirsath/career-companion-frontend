import type { ReactNode } from 'react';
import { useRouteContext, useRouterState } from '@tanstack/react-router';
import { OfflineLine, OfflinePage } from './OfflinePage';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useMenuCollapsed } from './useMenuCollapsed';

/** Laptops: the top bar, the side menu and the page on its sheet. Phones have `PhoneShell`. */
export function LaptopShell({ children }: { children: ReactNode }) {
  const user = useRouteContext({ from: '__root__', select: (context) => context.user });
  const [collapsed, setCollapsed] = useMenuCollapsed();
  // The first part of the path: a new section fades in, while a list and its detail pages (one
  // route tree that keeps the list's filters) stay mounted.
  const section = useRouterState({
    select: (state) => state.location.pathname.split('/')[1] ?? '',
  });
  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-text-primary">
      <TopBar user={user} collapsed={collapsed} />
      <div className="flex min-w-0 flex-1">
        <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
        <div className="mr-2 mb-2 flex min-w-0 flex-1 flex-col rounded-page bg-background shadow-[var(--sheet-shadow)]">
          <OfflineLine />
          <main className="flex-1 px-12 py-8">
            {/* One width for every page: the full width up to 1584px, centred beyond. */}
            <div key={section} className="mx-auto w-full max-w-[1584px] animate-page-in">
              <OfflinePage>{children}</OfflinePage>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
