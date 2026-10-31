import type { ReactNode } from 'react';
import { ArrowRight, type CarbonIconType } from '@carbon/icons-react';
import { PRIVACY_POLICY_URL } from '../../lib/productPage';
import { cn } from '../../lib/utils';

/**
 * The product page's links are plain links, not router links: the page also shows before the
 * router starts (see `SignInGate`).
 */
export const SIGN_IN_URL = '/login';

/** One band of the page, split from the next by a thin line, with the page's width and gutters. */
export function Band({
  labelledBy,
  className,
  children,
}: {
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="border-b border-border-subtle py-12 last:border-b-0 md:py-18"
    >
      <div className={cn('mx-auto w-full max-w-[1184px] px-4 md:px-12', className)}>{children}</div>
    </section>
  );
}

/** A band's title and the sentence under it. */
export function BandTitle({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <>
      <h2 id={id} className="text-2xl leading-8 font-normal md:text-[28px] md:leading-9">
        {title}
      </h2>
      <p className="mt-2 mb-8 max-w-[640px] text-base text-text-secondary">{lead}</p>
    </>
  );
}

/** A link to the privacy policy, with an arrow where it ends a part of the page. */
export function PrivacyLink({
  label = 'Read the privacy policy',
  arrow = false,
  className,
}: {
  label?: string;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <a
      href={PRIVACY_POLICY_URL}
      className={cn(
        'inline-flex items-center gap-2 text-sm text-link hover:text-link-hover hover:underline',
        className,
      )}
    >
      {label}
      {arrow && <ArrowRight size={16} aria-hidden="true" />}
    </a>
  );
}

/** A grid of tiles split by thin lines: two across on wider screens, one on phones. */
export function Tiles({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-px border border-border-subtle bg-border-subtle md:grid-cols-2">
      {children}
    </div>
  );
}

/** One tile: an icon, a title (with an optional note beside it), the text and an example. */
export function Tile({
  icon: Icon,
  title,
  note,
  example,
  children,
}: {
  icon: CarbonIconType;
  title: string;
  note?: ReactNode;
  example?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-background px-4 py-5 md:p-6">
      <Icon size={20} aria-hidden="true" className="mb-2 text-text-secondary" />
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-base leading-[22px] font-semibold">{title}</h3>
        {note}
      </div>
      <p className="text-text-secondary">{children}</p>
      {example && <div className="mt-2 flex flex-wrap items-center gap-1.5">{example}</div>}
    </div>
  );
}
