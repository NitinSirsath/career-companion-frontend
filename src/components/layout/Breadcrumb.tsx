import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, type CarbonIconType } from '@carbon/icons-react';
import { cn } from '../../lib/utils';
import { BreadcrumbSlotContext, useBreadcrumbSlot } from './breadcrumbSlot';
import { sectionOf } from './navItems';

/** Lets the pages of the signed-in app put their breadcrumb into the top bar. */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => {
    setClaims((count) => count + 1);
    return () => setClaims((count) => count - 1);
  }, []);
  const value = useMemo(
    () => ({ target, setTarget, claimed: claims > 0, claim }),
    [target, claims, claim],
  );
  return <BreadcrumbSlotContext.Provider value={value}>{children}</BreadcrumbSlotContext.Provider>;
}

const LEVEL_CLASS =
  'flex min-w-0 items-center gap-2 whitespace-nowrap [&_a]:text-text-secondary [&_a]:transition-colors [&_a]:duration-70 [&_a]:ease-standard [&_a:hover]:text-text-primary';

/** The section icon for a link to a section's page, such as Mails for a link to /mails. */
function iconOf(link: ReactNode): CarbonIconType | undefined {
  if (!isValidElement(link)) return undefined;
  const to = (link.props as { to?: unknown }).to;
  return typeof to === 'string' ? sectionOf(to)?.icon : undefined;
}

function Trail({
  links,
  current,
  CurrentIcon,
}: {
  links: ReactNode[];
  current?: string;
  CurrentIcon?: CarbonIconType;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0">
      <ol className="flex min-w-0 items-center gap-2.5">
        {links.map((link, index) => {
          const last = index === links.length - 1;
          const Icon = index === 0 ? iconOf(link) : undefined;
          return (
            <li key={index} className={cn(LEVEL_CLASS, !last && 'hidden md:flex')}>
              {/* On phones only the level above shows, as a way back. */}
              {last && <ChevronLeft size={16} aria-hidden="true" className="md:hidden" />}
              {Icon && <Icon size={16} aria-hidden="true" className="hidden md:block" />}
              {link}
              {(current || !last) && (
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="ml-0.5 hidden text-text-tertiary md:block"
                />
              )}
            </li>
          );
        })}
        {current && (
          <li aria-current="page" className={cn(LEVEL_CLASS, 'hidden text-text-primary md:flex')}>
            {CurrentIcon && <CurrentIcon size={16} aria-hidden="true" />}
            <span className="truncate">{current}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}

/**
 * "Mails › Lumen Apps": the links back up, then (optionally) this page's own short name. It shows
 * in the top bar; on phones only the link back to the level above shows.
 */
export function Breadcrumb({
  children,
  current,
  currentIcon,
}: {
  children: ReactNode;
  current?: string;
  currentIcon?: CarbonIconType;
}) {
  const slot = useBreadcrumbSlot();
  const claim = slot?.claim;
  useLayoutEffect(() => claim?.(), [claim]);
  const trail = (
    <Trail links={Children.toArray(children)} current={current} CurrentIcon={currentIcon} />
  );
  // Outside the signed-in app (as in some tests) the breadcrumb stays where it is written.
  if (!slot) return trail;
  return slot.target ? createPortal(trail, slot.target) : null;
}

/** The top bar's breadcrumb when the page has none of its own: the section the page is in. */
export function SectionCrumb({ path }: { path: string }) {
  const section = sectionOf(path);
  if (!section) return null;
  const Icon = section.icon;
  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex">
      <ol>
        <li aria-current="page" className={cn(LEVEL_CLASS, 'text-text-primary')}>
          <Icon size={16} aria-hidden="true" className="text-text-secondary" />
          {section.label}
        </li>
      </ol>
    </nav>
  );
}
