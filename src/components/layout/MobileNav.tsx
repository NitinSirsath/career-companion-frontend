import { Link } from '@tanstack/react-router';
import { MAIN_NAV, rememberedSearch } from './navItems';

// The chosen page: a light blue block behind its icon, and dark text.
const BAR_ITEM =
  'group flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium text-text-secondary transition-colors duration-70 ease-standard [&.active]:text-text-primary';

/** The bottom bar on phones: the three daily pages. Settings are in the menu, the account in the top bar. */
export function MobileNav() {
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed right-0 bottom-0 left-0 z-40 grid h-16 grid-cols-3 border-t border-border-subtle bg-background md:hidden"
    >
      {MAIN_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.to} to={item.to} search={rememberedSearch(item.to)} className={BAR_ITEM}>
            <span className="flex h-7 w-15 items-center justify-center transition-colors duration-110 ease-standard group-[.active]:bg-tint group-[.active]:text-tint-text">
              <Icon size={20} aria-hidden="true" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
