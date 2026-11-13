import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { usePhoneNav } from './phoneNav';

export interface PhoneAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** What screen readers hear, when the short label is not enough. */
  ariaLabel?: string;
}

/**
 * The floating glass bar at the bottom of a phone detail page (owner, 13 Nov 2026), where a tab's
 * first page has the tab bar: two to four buttons, each an icon over a short word. It goes into
 * the frame's bar place, so it slides with its page.
 */
export function ActionBar({ label, actions }: { label: string; actions: PhoneAction[] }) {
  const place = usePhoneNav()?.barTarget;
  if (!place) return null;
  return createPortal(
    <nav
      aria-label={label}
      className="glass absolute inset-x-[18px] bottom-[max(calc(env(safe-area-inset-bottom)-12px),10px)] z-20 grid h-[62px] auto-cols-fr grid-flow-col rounded-full p-1"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          aria-label={action.ariaLabel}
          className={cn(
            'flex min-w-0 cursor-pointer flex-col items-center justify-center gap-px rounded-full text-[10.5px] leading-[13px] font-semibold text-text-primary transition-[background-color,opacity] duration-350 active:bg-[var(--glass-pill)] active:duration-0',
            'disabled:cursor-default disabled:opacity-35',
          )}
        >
          {action.icon}
          <span className="max-w-full truncate px-1">{action.label}</span>
        </button>
      ))}
    </nav>,
    place,
  );
}
