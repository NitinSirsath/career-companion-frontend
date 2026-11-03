import { useEffect, useState } from 'react';

const KEY = 'career-companion-menu';

/** Tablet widths: the side menu shows, but at full width it leaves the page little room. */
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1199.98px)';

/** The user's own choice, if the browser kept one. */
function savedChoice(): boolean | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === null ? null : value === 'collapsed';
  } catch {
    return null;
  }
}

const tabletQuery = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia(TABLET_QUERY) : null;

/**
 * Whether the side menu is shrunk to icons. The browser remembers the user's choice; without one,
 * tablet widths start with icons only (owner, 3 Nov 2026) and follow the window as it changes.
 */
export function useMenuCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [saved, setSaved] = useState(savedChoice);
  const [tablet, setTablet] = useState(() => !!tabletQuery()?.matches);
  useEffect(() => {
    const query = tabletQuery();
    if (typeof query?.addEventListener !== 'function') return;
    const change = () => setTablet(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const change = (next: boolean) => {
    setSaved(next);
    try {
      localStorage.setItem(KEY, next ? 'collapsed' : 'open');
    } catch {
      // A blocked storage only means the choice is not remembered.
    }
  };
  return [saved ?? tablet, change];
}
