import type { ReactNode } from 'react';
import { Search } from '@carbon/icons-react';

/** One cell of the phone top bar with an icon button, as the page puts there with `TopBarActions`. */
export function TopBarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex w-12 shrink-0 cursor-pointer items-center justify-center border-l border-border-subtle text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover"
    >
      {children}
    </button>
  );
}

/** The phone top bar's search: puts the cursor in the page's own search box. */
export function TopBarSearch({ targetId, label }: { targetId: string; label: string }) {
  return (
    <TopBarButton label={label} onClick={() => document.getElementById(targetId)?.focus()}>
      <Search size={20} aria-hidden="true" />
    </TopBarButton>
  );
}
