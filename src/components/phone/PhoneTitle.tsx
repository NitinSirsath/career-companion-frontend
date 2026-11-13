import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { usePhoneNav } from './phoneNav';

/**
 * A page's big title on phones (owner, 13 Nov 2026): 34px on a tab's list, 28px on a detail page.
 * It scrolls away under the top bar, where the small title then shows; pulling down at the top
 * makes it a little bigger. `barTitle`: shorter words for the top bar, such as the company for a
 * mail's long subject.
 */
export function PhoneTitle({
  children,
  barTitle,
  size = 'list',
  className,
}: {
  children: ReactNode;
  barTitle?: string;
  size?: 'list' | 'detail';
  className?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const setBigTitle = usePhoneNav()?.setBigTitle;
  const words = typeof children === 'string' ? children : null;
  useLayoutEffect(() => {
    if (!setBigTitle) return;
    setBigTitle(barTitle ?? words ?? heading.current?.textContent ?? '');
    return () => setBigTitle(null);
  }, [setBigTitle, barTitle, words]);
  return (
    <h1
      ref={heading}
      data-big-title=""
      className={cn(
        'origin-[0_60%] font-bold break-words text-text-primary',
        size === 'list'
          ? 'text-[34px] leading-[41px] tracking-[0.01em]'
          : 'text-[28px] leading-[34px] tracking-[0.005em]',
        className,
      )}
    >
      {children}
    </h1>
  );
}
