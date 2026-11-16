import { useEffect, useState } from 'react';

/** How a row of a moving list is drawn: as it was, growing in, or shrinking away. */
export type ListPhase = 'stay' | 'enter' | 'leave';

export interface ListEntry<T> {
  key: string;
  item: T;
  phase: ListPhase;
}

/** How long a removed row stays on screen while it shrinks away. */
export const LEAVE_MS = 280;

/**
 * Puts the new list next to the one on screen. A row that is gone stays where it was, after the
 * last row before it that is still there, and shrinks away; a new row grows in. `old` null: a new
 * list (other filters, another page), drawn as it is.
 */
function merge<T>(
  old: readonly ListEntry<T>[] | null,
  items: readonly T[],
  keyOf: (item: T) => string,
  growFirst = false,
): ListEntry<T>[] {
  const known = new Set(old?.filter((e) => e.phase !== 'leave').map((e) => e.key));
  // The first load (nothing on screen yet) is drawn at once, not grown in row by row.
  const grow = !!old && (growFirst || known.size > 0);
  const next = items.map((item) => {
    const key = keyOf(item);
    return { key, item, phase: grow && !known.has(key) ? 'enter' : 'stay' } as ListEntry<T>;
  });
  if (!old) return next;
  const nextKeys = new Set(next.map((e) => e.key));
  const leavingAfter = new Map<string | null, ListEntry<T>[]>();
  let anchor: string | null = null;
  for (const entry of old) {
    if (nextKeys.has(entry.key)) {
      anchor = entry.key;
      continue;
    }
    const group = leavingAfter.get(anchor) ?? [];
    group.push({ ...entry, phase: 'leave' });
    leavingAfter.set(anchor, group);
  }
  const merged = [...(leavingAfter.get(null) ?? [])];
  for (const entry of next) merged.push(entry, ...(leavingAfter.get(entry.key) ?? []));
  return merged;
}

/**
 * A list whose rows move (15 Nov 2026): a row that leaves, such as a mail marked done under
 * "Needs action", shrinks away where it was, and a row that arrives grows in, instead of the list
 * jumping. `listKey` names the list (its filters and page): when it changes the new list is drawn
 * at once, so changing a filter never sends every row away. Pass a different key while the rows
 * on screen are a placeholder from the last list. No key: the rows are drawn as they are.
 */
export function useListMotion<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  listKey: string | undefined,
  /** Grow in the first row too, when the list was empty: filter pills, not a list's first load. */
  growFirst = false,
): ListEntry<T>[] {
  // Rows are compared by their keys, not by the array, so a caller that builds a new array on
  // every render does not start the motion again and again.
  const keys = items.map(keyOf).join('\u0000');
  const [seen, setSeen] = useState({ keys, listKey });
  const [entries, setEntries] = useState<ListEntry<T>[]>(() => merge(null, items, keyOf));
  // The prev-value pattern: compare during render, so the new rows show in this same render.
  let current = entries;
  if (seen.keys !== keys || seen.listKey !== listKey) {
    current = merge(seen.listKey === listKey ? entries : null, items, keyOf, growFirst);
    setSeen({ keys, listKey });
    setEntries(current);
  }
  const leaving = current.some((entry) => entry.phase === 'leave');
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(
      () => setEntries((now) => now.filter((entry) => entry.phase !== 'leave')),
      LEAVE_MS,
    );
    return () => clearTimeout(timer);
  }, [entries, leaving]);
  if (listKey === undefined) return merge(null, items, keyOf);
  // Rows still in the list show their newest data; a leaving row shows what it last was.
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  return current.map((entry) =>
    entry.phase === 'leave' ? entry : { ...entry, item: byKey.get(entry.key) ?? entry.item },
  );
}

/** The wrapper class for a row's phase: grow in, shrink away, or nothing. */
export function listPhaseClass(phase: ListPhase): string | undefined {
  if (phase === 'enter') return 'grid animate-reveal';
  if (phase === 'leave') return 'pointer-events-none grid animate-unreveal';
  return undefined;
}

/** A filter pill's class for its phase: it pops in, and fades and shrinks as it goes. */
export function pillPhaseClass(phase: ListPhase): string | undefined {
  if (phase === 'enter') return 'animate-pill-in';
  if (phase === 'leave') return 'pointer-events-none animate-pill-out';
  return undefined;
}

/** Props for a leaving row: out of the tab order and hidden from screen readers. */
export function leavingProps(phase: ListPhase) {
  return phase === 'leave' ? ({ inert: true, 'aria-hidden': true } as const) : {};
}
