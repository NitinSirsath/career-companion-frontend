import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { PRESS } from './GlassButton';
import { usePhoneNav } from './phoneNav';

/**
 * The bar at the bottom of a phone detail page (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/`
 * screens 2 and 13): a glass circle, a glass field, a glass circle, where a tab's first page has
 * the tab bar. The tab bar's glass reshapes into the field as the page slides in, so the field
 * itself draws no glass in the frame. Put one `BarField` and up to two `BarCircle`s inside, in
 * order: `<PhoneBottomBar label="Mail actions"><BarCircle/><BarField/><BarCircle/></PhoneBottomBar>`.
 */
export function PhoneBottomBar({ label, children }: { label: string; children: ReactNode }) {
  const place = usePhoneNav()?.barTarget;
  if (!place) return null;
  return createPortal(
    <nav aria-label={label} className="absolute inset-0 flex items-center gap-2">
      {children}
    </nav>,
    place,
  );
}

/** A round glass button in the bottom bar: AI reply, Open in Gmail. */
export function BarCircle({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'glass flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-default disabled:opacity-40',
        PRESS,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * The wide field in the bottom bar: an icon and grey words that open the main thing to write,
 * "Reply to Priya", "Message to everyone". It marks itself so the tab bar's glass can take its
 * shape.
 */
export function BarField({
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      data-bar-field=""
      className={cn(
        'flex h-12 min-w-0 flex-1 cursor-pointer items-center gap-[9px] rounded-full px-4 text-left text-[16px] text-text-secondary outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus disabled:cursor-default disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {icon && <span className="flex shrink-0 text-text-primary [&_svg]:size-[19px]">{icon}</span>}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
