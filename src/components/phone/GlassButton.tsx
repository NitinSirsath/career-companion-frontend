import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Grows a little while pressed and springs back, as iPhone glass buttons do. */
export const PRESS =
  'transition-transform duration-450 ease-[cubic-bezier(0.25,1.6,0.4,1)] active:scale-110 active:duration-120 active:ease-out';

/**
 * A round frosted button that floats over the page (owner, 13 Nov 2026): Back, ⓘ. In the text
 * colour, 44px, so it is easy to hit.
 */
export function GlassButton({
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
        'glass flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus',
        PRESS,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Two or three icon buttons in one frosted capsule: refresh, search, filters on a list. */
export function GlassCapsule({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="glass flex h-11 shrink-0 rounded-full">
      {children}
    </div>
  );
}

/** One button in a capsule. */
export function CapsuleButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex h-11 w-[46px] cursor-pointer items-center justify-center rounded-full text-text-primary outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus disabled:cursor-default',
        PRESS,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
