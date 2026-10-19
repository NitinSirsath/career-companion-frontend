import { useState } from 'react';

const KEY = 'career-companion-menu';

/** Whether the side menu is shrunk to icons; the browser remembers the choice. */
export function useMenuCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const change = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(KEY, next ? 'collapsed' : 'open');
    } catch {
      // A blocked storage only means the choice is not remembered.
    }
  };
  return [collapsed, change];
}
