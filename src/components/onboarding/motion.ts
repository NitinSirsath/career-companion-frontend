import { useEffect, useState } from 'react';
import { reducedMotion } from '../../lib/viewTransition';

/** Words that type themselves, two letters at a time; all at once with Reduce Motion. */
export function useTyped(text: string) {
  const [count, setCount] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    const timer = setInterval(() => {
      setCount((n) => {
        if (n >= text.length) clearInterval(timer);
        return Math.min(text.length, n + 2);
      });
    }, 28);
    return () => clearInterval(timer);
  }, [text]);
  return { shown: text.slice(0, count), typing: count < text.length };
}

/** A delay for a row that slides in, by its place in the list. */
export const rowDelay = (i: number) => ({ '--d': i }) as React.CSSProperties;
