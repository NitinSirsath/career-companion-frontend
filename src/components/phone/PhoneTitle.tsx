import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { usePhoneNav } from './phoneNav';

/**
 * A page's big title on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/`): 30px bold on a
 * tab's list, where it sits in the same row as the glass buttons and stops before them; 25px on a
 * detail page. It scrolls away under the top bar, where the small title then fades in; pulling
 * down at the top makes it a little bigger. `barTitle`: shorter words for the top bar, such as the company for a
 * mail's long subject. `size="bar"`: a setup page (mock screens 9, 10, 13: Gmail sync, AI
 * providers, Admin) has no big title; its small title is always in the middle of the top bar and
 * the heading is kept for screen readers only.
 */
export function PhoneTitle({
  children,
  barTitle,
  size = 'list',
  className,
}: {
  children: ReactNode;
  barTitle?: string;
  size?: 'list' | 'detail' | 'bar';
  className?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const nav = usePhoneNav();
  const setBigTitle = nav?.setBigTitle;
  const words = typeof children === 'string' ? children : null;
  useLayoutEffect(() => {
    if (!setBigTitle) return;
    setBigTitle(barTitle ?? words ?? heading.current?.textContent ?? '');
    return () => setBigTitle(null);
  }, [setBigTitle, barTitle, words]);
  const title = (
    <h1
      ref={heading}
      data-big-title={size === 'bar' ? undefined : ''}
      data-bar-title={size === 'bar' ? '' : undefined}
      className={cn(
        'origin-[0_60%] font-bold break-words text-text-primary',
        size === 'list' &&
          'min-h-11 py-1 pr-[calc(var(--phone-actions-w,0px)+12px)] pl-0.5 text-phone-title',
        size === 'detail' && 'text-phone-detail',
        size === 'bar' && 'sr-only',
        className,
      )}
    >
      {children}
    </h1>
  );
  // A list's title goes up into the row beside the top buttons.
  const place = size === 'list' && nav?.isRoot ? nav.titleTarget : null;
  return place ? createPortal(title, place) : title;
}
